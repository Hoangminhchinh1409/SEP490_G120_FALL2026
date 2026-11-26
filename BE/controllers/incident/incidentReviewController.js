const prisma = require('../../config/prisma');
const { serializePrisma } = require('../../utils/prismaHelper');
const cloudinaryService = require('../../services/cloudinaryService');
const { parseOrderMeta } = require('../../services/orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail
} = require('../../services/emailService');
const {
  INCIDENT_SAFE_SELECT,
  mapOrderSummaryAliases
} = require('./incidentHelper');

const resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { fault, compensation_amount, resolution_note } = req.body;
    const managerId = req.user?.id || null;

    if (!fault) {
      return res.status(400).json({ message: 'Vui lòng xác định bên có lỗi (Công ty, Khách hàng, Bên thứ ba).' });
    }

    const amountNum = Number(compensation_amount) || 0;
    const nowDate = new Date();
    const resolvedByInt = managerId ? Number(managerId) : null;

    const updatedIncRow = await prisma.incidents.update({
      where: { id: BigInt(id) },
      data: {
        fault: fault,
        resolution_note: resolution_note || 'Quản lý đã thẩm định và giải quyết sự cố.',
        status: 'RESOLVED',
        resolved_by: resolvedByInt,
        resolved_time: nowDate,
        updated_at: nowDate
      },
      select: INCIDENT_SAFE_SELECT
    });
    const updatedInc = serializePrisma(updatedIncRow);

    //: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
    let createdClaim = null;
    if (amountNum > 0) {
      const existingClaim = await prisma.compensation_claims.findFirst({
        where: { incident_id: BigInt(id) },
        select: { id: true }
      });

      if (!existingClaim) {
        let orderId = null;
        if (updatedInc.trip_id) {
          const firstStop = await prisma.trip_stops.findFirst({
            where: { trip_id: BigInt(updatedInc.trip_id) },
            select: { id: true, order_id: true }
          });

          if (firstStop?.order_id) {
            orderId = firstStop.order_id;
          } else if (firstStop?.id) {
            const stopOrder = await prisma.delivery_evidences.findFirst({
              where: { trip_stop_id: firstStop.id, order_id: { not: null } },
              select: { order_id: true }
            });
            orderId = stopOrder?.order_id || null;
          }
        }

        if (!orderId) {
          const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
          orderId = anyOrder?.id || BigInt(37);
        }

        try {
          const newClaimRow = await prisma.compensation_claims.create({
            data: {
              incident_id: BigInt(id),
              order_id: BigInt(orderId),
              source: 'INCIDENT',
              amount: BigInt(Math.round(amountNum)),
              reason: `Bồi thường phát sinh từ sự cố INC-${String(id).padStart(3, '0')}: ${resolution_note || updatedInc.description || 'Lỗi vận hành'}`,
              status: 'PENDING',
              created_by: Number(managerId || 20)
            }
          });
          createdClaim = serializePrisma(newClaimRow);
        } catch (claimErr) {
          console.error('Tự động tạo compensation_claim thất bại:', claimErr);
        }
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: resolvedByInt,
          actor_type: 'MANAGER',
          action: 'RESOLVE_INCIDENT',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: { fault, compensation_amount: amountNum, status: 'RESOLVED' },
          reason: resolution_note || null,
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã giải quyết sự cố thành công.',
      incident: updatedInc,
      claim: createdClaim
    });
  } catch (error) {
    console.error('resolveIncident Error:', error);
    return res.status(500).json({ message: 'Lỗi khi giải quyết sự cố', error: error.message });
  }
};

/**
 * Manager quyết định Xét duyệt hoặc Từ chối bồi thường (State: APPROVED | DONE)
 */
const decideIncidentCompensation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      action, // 'APPROVE' | 'REJECT'
      fault,
      approved_amount,
      damage_percentage,
      goods_handling_method,
      contract_clause_ref,
      survey_org_report,
      rejection_reason,
      contact_hotline,
      resolution_note
    } = req.body;
    const managerId = req.user?.id || 1;

    const isRequestMoreInfo = action === 'REQUEST_MORE_INFO';
    const isApprove = action === 'APPROVE' || action === 'Approve';
    // Sau khi Manager chốt giá bồi thường và gửi email cho khách -> kết thúc luồng (DONE)
    // Nếu từ chối: Đơn phương dứt điểm theo căn cứ hợp đồng -> đóng ngay (DONE)
    // Nếu yêu cầu bổ sung hồ sơ: Chuyển IN_PROGRESS để ĐPV/Tài xế/Khách hàng tải thêm ảnh/chứng từ
    let targetStatus = 'DONE';
    if (isRequestMoreInfo) targetStatus = 'IN_PROGRESS';

    if (!isApprove && !isRequestMoreInfo) {
      if (!rejection_reason || !rejection_reason.trim()) {
        return res.status(400).json({ message: 'Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.' });
      }
      if (!contract_clause_ref || !contract_clause_ref.trim()) {
        return res.status(400).json({ message: 'Bắt buộc viện dẫn điều khoản hợp đồng áp dụng khi từ chối bồi thường.' });
      }
    }

    // BUG-SYS-32: Chặn duyệt mức bồi thường vượt quá hạn mức trách nhiệm của hợp đồng (hoặc trần luật định 500.000.000 VNĐ)
    if (isApprove) {
      const requestedApprove = Number(approved_amount || 0);
      const incCheck = await prisma.incidents.findUnique({
        where: { id: BigInt(id) },
        select: {
          order_id: true,
          orders: { select: { customer_id: true } }
        }
      });
      let effectiveCap = 500000000;
      if (incCheck?.orders?.customer_id) {
        const activeContract = await prisma.contracts.findFirst({
          where: { customer_id: incCheck.orders.customer_id },
          orderBy: { id: 'desc' },
          select: { liability_cap: true }
        });
        if (activeContract?.liability_cap && Number(activeContract.liability_cap) > 0) {
          effectiveCap = Number(activeContract.liability_cap);
        }
      }
      if (requestedApprove > effectiveCap) {
        return res.status(400).json({
          message: `Số tiền bồi thường (${requestedApprove.toLocaleString('vi-VN')} VNĐ) vượt quá giới hạn trách nhiệm tối đa cho phép (${effectiveCap.toLocaleString('vi-VN')} VNĐ).`
        });
      }
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const resolutionNoteFull = resolution_note || (
      isApprove
        ? `Quản lý đã phê duyệt bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ theo ${contract_clause_ref || 'Hợp đồng vận tải'}. (Hư hỏng: ${damage_percentage || 0}%, xử lý: ${goods_handling_method || 'Khách giữ'})`
        : isRequestMoreInfo
        ? 'Quản lý yêu cầu bổ sung thêm hồ sơ / biên bản giám định hiện trường.'
        : `Từ chối bồi thường theo ${contract_clause_ref || 'Hợp đồng'}. Lý do: ${rejection_reason}`
    );

    const extendedMetadata = {
      ...(damage_percentage !== undefined && damage_percentage !== null ? { damage_percentage: Number(damage_percentage) } : {}),
      ...(goods_handling_method ? { goods_handling_method } : {}),
      ...(contract_clause_ref ? { contract_clause_ref } : {}),
      approved_compensation_amount: isApprove ? (Number(approved_amount) || 0) : 0,
      rejection_reason: (!isApprove && !isRequestMoreInfo) ? rejection_reason.trim() : null,
      contact_hotline: contact_hotline || '1900 1234'
    };

    const corePayload = {
      fault: fault || (isApprove ? 'COMPANY' : 'CUSTOMER'),
      resolution_note: String(resolutionNoteFull || '').slice(0, 500),
      status: targetStatus,
      resolved_by: managerInt,
      resolved_time: nowDate,
      updated_at: nowDate
    };

    let updatedInc = null;
    try {
      const updatedIncRow = await prisma.incidents.update({
        where: { id: BigInt(id) },
        data: corePayload,
        select: INCIDENT_SAFE_SELECT
      });
      updatedInc = serializePrisma(updatedIncRow);
    } catch (incErr) {
      console.warn('Fallback incidents status retry with compatible status:', incErr.message);
      try {
        const retryRow = await prisma.incidents.update({
          where: { id: BigInt(id) },
          data: {
            ...corePayload,
            status: isRequestMoreInfo ? 'ESCALATED' : 'RESOLVED'
          },
          select: INCIDENT_SAFE_SELECT
        });
        updatedInc = serializePrisma(retryRow);
      } catch (retryErr) {
        console.warn('Retry incidents update warning:', retryErr.message);
      }
    }

    // Đồng bộ hoặc tạo mới bản ghi trong bảng compensation_claims
    const claimStatus = isApprove ? 'APPROVED' : isRequestMoreInfo ? 'PENDING' : 'REJECTED';
    const approvedClaimAmount = BigInt(isApprove ? Math.round(Number(approved_amount) || 0) : 0);
    const existingClaims = await prisma.compensation_claims.findMany({
      where: { incident_id: BigInt(id) },
      select: { id: true }
    });

    if (existingClaims && existingClaims.length > 0) {
      try {
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: {
            status: claimStatus,
            amount: approvedClaimAmount,
            reviewed_by: managerInt,
            reviewed_time: nowDate,
            review_comment: resolutionNoteFull,
            updated_at: nowDate
          }
        });
      } catch (claimUpdErr) {
        console.warn('compensation_claims update warning:', claimUpdErr.message);
      }
    } else {
      // Tìm order_id thực tế của chuyến xe
      let tripIdToLookup = updatedInc?.trip_id;
      if (!tripIdToLookup) {
        const curInc = await prisma.incidents.findUnique({
          where: { id: BigInt(id) },
          select: { trip_id: true }
        });
        tripIdToLookup = curInc?.trip_id ? Number(curInc.trip_id) : null;
      }

      let orderId = null;
      if (tripIdToLookup) {
        const stop = await prisma.trip_stops.findFirst({
          where: {
            trip_id: BigInt(tripIdToLookup),
            order_id: { not: null }
          },
          select: { order_id: true }
        });
        if (stop?.order_id) orderId = stop.order_id;
      }
      if (!orderId) {
        const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        try {
          await prisma.compensation_claims.create({
            data: {
              incident_id: BigInt(id),
              order_id: BigInt(orderId),
              source: 'INCIDENT',
              amount: approvedClaimAmount,
              reason: resolutionNoteFull,
              status: claimStatus,
              created_by: managerInt,
              reviewed_by: managerInt,
              reviewed_time: nowDate,
              review_comment: resolutionNoteFull,
              updated_at: nowDate
            }
          });
        } catch (claimInsErr) {
          console.warn('compensation_claims insert warning:', claimInsErr.message);
        }
      }
    }

    // Gửi Email thông báo kết quả Duyệt / Từ chối bồi thường tới Khách hàng
    let emailResult = { sent: false, customer_email: null, email_type: null, email_sent_at: null };
    if (isApprove || !isRequestMoreInfo) {
      try {
        let tripIdForEmail = updatedInc?.trip_id || null;
        let incMeta = updatedInc || null;
        if (!incMeta) {
          const curInc = await prisma.incidents.findUnique({
            where: { id: BigInt(id) },
            select: { id: true, trip_id: true, type: true, reported_by: true }
          });
          incMeta = serializePrisma(curInc);
          tripIdForEmail = incMeta?.trip_id || null;
        }

        let orderForEmail = null;
        let tripCodeForEmail = tripIdForEmail ? `TRIP-${tripIdForEmail}` : '';
        if (tripIdForEmail) {
          const [tripRow, firstStop] = await Promise.all([
            prisma.trips.findUnique({
              where: { id: BigInt(tripIdForEmail) },
              select: { id: true, trip_code: true }
            }),
            prisma.trip_stops.findFirst({
              where: {
                trip_id: BigInt(tripIdForEmail),
                order_id: { not: null }
              },
              select: {
                orders: {
                  select: {
                    id: true,
                    order_code: true,
                    agreed_price: true,
                    tracking_token: true,
                    receiver_name: true,
                    order_notes: true,
                    customers: { select: { company_name: true, contact_person: true, email: true, phone: true } },
                    order_cargos: { select: { cargo_name: true, quantity: true, unit: true, actual_weight_kg: true, declared_value: true } }
                  }
                }
              }
            })
          ]);
          if (tripRow?.trip_code) tripCodeForEmail = tripRow.trip_code;
          orderForEmail = firstStop?.orders ? mapOrderSummaryAliases(firstStop.orders) : null;
        }

        const meta = orderForEmail ? parseOrderMeta(orderForEmail) : {};
        const firstCargo = Array.isArray(orderForEmail?.order_cargos)
          ? orderForEmail.order_cargos[0]
          : orderForEmail?.order_cargos;
        const customerEmail =
          orderForEmail?.customer?.email ||
          meta?.customer_email ||
          'khachhang@example.com';
        const customerName =
          orderForEmail?.customer?.company_name ||
          orderForEmail?.receiver_name ||
          'Quý khách hàng';
        const contactPerson =
          orderForEmail?.customer?.contact_person ||
          orderForEmail?.receiver_name ||
          '';
        const orderCode = orderForEmail?.order_code || `NEX-${id}`;
        const cargoDescription = firstCargo?.cargo_name
          ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
          : 'Hàng hóa theo vận đơn';
        const declaredValue =
          Number(firstCargo?.declared_value || 0) ||
          Number(orderForEmail?.agreed_price || 0) * 10 ||
          120000000;
        const incidentCode = `INC-${String(id).padStart(3, '0')}`;
        const claimCode = existingClaims?.[0]?.id
          ? `CLM-${String(existingClaims[0].id).padStart(4, '0')}`
          : `CLM-${String(id).padStart(4, '0')}`;
        const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
        const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
        const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

        let sendRes;
        if (isApprove) {
          sendRes = await sendIncidentCompensationApprovalEmail({
            customerEmail,
            customerName,
            contactPerson,
            orderCode,
            tripCode: tripCodeForEmail,
            incidentCode,
            claimCode,
            incidentType: incMeta?.type || 'Sự cố vận chuyển hàng hóa',
            cargoDescription,
            declaredValue,
            damagePercentage: damage_percentage || 0,
            approvedAmount: Number(approved_amount) || 0,
            goodsHandlingMethod: goods_handling_method || 'CUSTOMER_RETAIN',
            contractClauseRef: contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa',
            resolutionNote: resolutionNoteFull,
            surveyOrgReport: survey_org_report || '',
            contactHotline: contact_hotline || '1900 1234',
            trackingUrl
          });
        } else {
          sendRes = await sendIncidentCompensationRejectionEmail({
            customerEmail,
            customerName,
            contactPerson,
            orderCode,
            tripCode: tripCodeForEmail,
            incidentCode,
            claimCode,
            incidentType: incMeta?.type || 'Sự cố vận chuyển hàng hóa',
            cargoDescription,
            rejectionReason: rejection_reason,
            rejectionClause: contract_clause_ref || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng',
            resolutionNote: resolutionNoteFull,
            contactHotline: contact_hotline || '1900 1234',
            trackingUrl
          });
        }

        emailResult = {
          sent: Boolean(sendRes?.success),
          customer_email: customerEmail,
          email_type: isApprove ? 'APPROVAL' : 'REJECTION',
          email_sent_at: sendRes?.success ? now : null,
          preview_url: sendRes?.previewUrl || null
        };
      } catch (mailErr) {
        console.warn('Gửi email quyết định bồi thường warning:', mailErr.message);
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerInt,
          actor_type: 'MANAGER',
          action: isApprove ? 'APPROVE_INCIDENT_COMPENSATION' : isRequestMoreInfo ? 'REQUEST_MORE_INFO_INCIDENT' : 'REJECT_INCIDENT_COMPENSATION',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: {
            ...corePayload,
            resolved_time: now,
            updated_at: now,
            ...extendedMetadata,
            email_sent: emailResult.sent,
            customer_email: emailResult.customer_email,
            email_type: emailResult.email_type,
            email_sent_at: emailResult.email_sent_at
          },
          reason: String(isApprove ? resolution_note : isRequestMoreInfo ? resolution_note : rejection_reason || '').slice(0, 255),
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    // Gửi thông báo tới Điều phối viên (role_id = 3) và Tài xế báo sự cố
    try {
      const incidentCode = `INC-${String(id).padStart(3, '0')}`;
      const notifyMsg = isApprove
        ? `[${incidentCode}] Quản lý đã chốt mức bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ và gửi email xác nhận cho khách hàng (Hoàn tất hồ sơ).`
        : isRequestMoreInfo
          ? `[${incidentCode}] Quản lý yêu cầu bổ sung hồ sơ/minh chứng: ${resolution_note || 'Kiểm tra chi tiết sự cố.'}`
          : `[${incidentCode}] Quản lý đã từ chối bồi thường theo ${contract_clause_ref || 'hợp đồng'} và đóng hồ sơ.`;

      const recipientIds = new Set();
      const dispatchers = await prisma.users.findMany({
        where: { role_id: 3 },
        select: { id: true }
      });
      (dispatchers || []).forEach((u) => {
        if (u?.id) recipientIds.add(Number(u.id));
      });

      if (updatedInc?.reported_by) {
        const driverProfile = await prisma.driver_profiles.findUnique({
          where: { id: BigInt(updatedInc.reported_by) },
          select: { user_account_id: true }
        });
        if (driverProfile?.user_account_id) {
          recipientIds.add(Number(driverProfile.user_account_id));
        }
      }

      if (recipientIds.size > 0) {
        const notifRows = Array.from(recipientIds).map((uid) => ({
          user_account_id: BigInt(uid),
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          message: notifyMsg,
          created_time: nowDate
        }));
        await prisma.notifications.createMany({ data: notifRows });
      }
    } catch (notifyErr) {
      console.warn('notify decideIncidentCompensation warning:', notifyErr.message);
    }

    const msg = isApprove
      ? `Đã chốt mức bồi thường ${(Number(approved_amount) || 0).toLocaleString('vi-VN')} đ${emailResult.sent ? ` và gửi email xác nhận tới ${emailResult.customer_email}` : ''} — Hoàn tất đóng hồ sơ.`
      : isRequestMoreInfo
      ? 'Đã gửi yêu cầu bổ sung hồ sơ tới Điều phối viên & Khách hàng thành công.'
      : `Đã từ chối bồi thường${emailResult.sent ? ` và gửi email thông báo tới ${emailResult.customer_email}` : ''} — Hoàn tất đóng hồ sơ (DONE).`;

    return res.json({
      message: msg,
      incident: updatedInc ? { ...updatedInc, ...extendedMetadata } : { id: Number(id), ...corePayload, ...extendedMetadata },
      email_result: emailResult
    });
  } catch (error) {
    console.error('decideIncidentCompensation Error:', error);
    return res.status(500).json({ message: 'Lỗi khi ra quyết định bồi thường sự cố', error: error.message });
  }
};

/**
 * Manager/Điều phối viên xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố (APPROVED -> DONE)
 */
const closeIncidentCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_proof_url, close_note, payment_date, transaction_code, approved_amount } = req.body;
    const managerId = req.user?.id || 1;

    if (!payment_proof_url || !payment_proof_url.trim()) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ảnh biên lai / chứng từ chuyển khoản ngân hàng để đóng hồ sơ.' });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const proofStr = await cloudinaryService.uploadDataUriIfNeeded(payment_proof_url, 'nexlog/claims');
    const noteInput = String(close_note || '').trim();
    const txMatch = noteInput.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    const dateMatch = noteInput.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);

    const payDate = payment_date || (dateMatch ? dateMatch[1] : now.split('T')[0]);
    const txCode = String(transaction_code || (txMatch ? txMatch[1] : '') || `FT${payDate.replace(/[^0-9]/g, '').slice(2, 8)}${String(id).padStart(4, '0')}`).trim();
    const closeNoteFull = noteInput || `Đã hoàn tất chi tiền ngày ${payDate}. Mã GD: ${txCode}`;

    // Đọc thông tin sự cố hiện có để bảo toàn nhận xét phê duyệt & trip_id
    const existingInc = await prisma.incidents.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, trip_id: true, resolution_note: true }
    });

    const existingClaims = await prisma.compensation_claims.findMany({
      where: { incident_id: BigInt(id) },
      select: { id: true, amount: true }
    });

    const resolvedPaidAmount = Number(
      approved_amount ||
      existingClaims?.[0]?.amount ||
      0
    );

    const prevNote = existingInc?.resolution_note ? `${existingInc.resolution_note} | ` : '';
    const mergedNote = `${prevNote}[ĐÃ CHI TIỀN - Ngày: ${payDate} | Mã GD: ${txCode}]`.slice(0, 500);

    const coreClosePayload = {
      status: 'DONE',
      resolution_note: mergedNote,
      resolved_by: managerInt,
      resolved_time: nowDate,
      updated_at: nowDate
    };

    let updatedInc = null;
    try {
      const updatedIncRow = await prisma.incidents.update({
        where: { id: BigInt(id) },
        data: coreClosePayload,
        select: INCIDENT_SAFE_SELECT
      });
      updatedInc = serializePrisma(updatedIncRow);
    } catch (incErr) {
      console.warn('Close incident status DONE failed, retry with RESOLVED:', incErr.message);
      try {
        const retryRow = await prisma.incidents.update({
          where: { id: BigInt(id) },
          data: {
            ...coreClosePayload,
            status: 'RESOLVED'
          },
          select: INCIDENT_SAFE_SELECT
        });
        updatedInc = serializePrisma(retryRow);
      } catch (retryErr) {
        console.warn('Close incident retry warning:', retryErr.message);
      }
    }

    // Cập nhật hoặc tạo mới bản ghi compensation_claims để lưu chứng từ UNC & ghi chú giao dịch
    if (existingClaims && existingClaims.length > 0) {
      const claimPayload = {
        status: 'PAID',
        evidence: proofStr,
        review_comment: closeNoteFull,
        reviewed_by: managerInt,
        reviewed_time: nowDate,
        updated_at: nowDate,
        ...(resolvedPaidAmount > 0 ? { amount: BigInt(Math.round(resolvedPaidAmount)) } : {})
      };
      try {
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: claimPayload
        });
      } catch (paidErr) {
        console.warn('compensation_claims status PAID rejected by constraint, retry with APPROVED:', paidErr.message);
        await prisma.compensation_claims.updateMany({
          where: { incident_id: BigInt(id) },
          data: {
            ...claimPayload,
            status: 'APPROVED'
          }
        });
      }
    } else {
      let orderId = null;
      const tripIdToLookup = updatedInc?.trip_id || (existingInc?.trip_id ? Number(existingInc.trip_id) : null);
      if (tripIdToLookup) {
        const stop = await prisma.trip_stops.findFirst({
          where: {
            trip_id: BigInt(tripIdToLookup),
            order_id: { not: null }
          },
          select: { order_id: true }
        });
        if (stop?.order_id) orderId = stop.order_id;
      }
      if (!orderId) {
        const anyOrder = await prisma.orders.findFirst({ select: { id: true } });
        orderId = anyOrder?.id || null;
      }

      if (orderId) {
        await prisma.compensation_claims.create({
          data: {
            incident_id: BigInt(id),
            order_id: BigInt(orderId),
            source: 'INCIDENT',
            amount: BigInt(Math.round(resolvedPaidAmount)),
            reason: closeNoteFull,
            evidence: proofStr,
            status: 'APPROVED',
            created_by: managerInt,
            reviewed_by: managerInt,
            reviewed_time: nowDate,
            review_comment: closeNoteFull,
            updated_at: nowDate
          }
        });
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerInt,
          actor_type: 'MANAGER',
          action: 'CLOSE_INCIDENT_CASE_DONE',
          target_type: 'INCIDENT',
          target_id: BigInt(id),
          changes: {
            status: updatedInc?.status || coreClosePayload.status,
            resolution_note: mergedNote,
            resolved_by: managerInt,
            resolved_time: now,
            payment_date: payDate,
            transaction_code: txCode,
            payment_proof_url: proofStr,
            close_note: closeNoteFull,
            approved_amount: resolvedPaidAmount
          },
          reason: closeNoteFull.slice(0, 255),
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    return res.json({
      message: 'Đã xác nhận hoàn tất bồi thường và đóng hồ sơ sự cố thành công (DONE).',
      incident: {
        ...(updatedInc || { id: Number(id), ...coreClosePayload }),
        payment_date: payDate,
        transaction_code: txCode,
        payment_proof_url: proofStr,
        payment_note: closeNoteFull,
        approved_compensation_amount: resolvedPaidAmount
      }
    });
  } catch (error) {
    console.error('closeIncidentCase Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi đóng hồ sơ sự cố', error: error.message });
  }
};

module.exports = {
  resolveIncident,
  decideIncidentCompensation,
  closeIncidentCase
};
