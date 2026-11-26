const prisma = require('../../config/prisma');
const { serializePrisma, formatDateOnly } = require('../../utils/prismaHelper');
const cloudinaryService = require('../../services/cloudinaryService');
const { parseOrderMeta } = require('../../services/orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
} = require('../../services/emailService');
const {
  INCIDENT_SAFE_SELECT,
  parseIncidentIdParam,
  mapOrderSummaryAliases
} = require('./incidentHelper');

const resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseIncidentIdParam(id);
    if (!numId) {
      return res.status(400).json({ message: 'Mã sự cố không hợp lệ.' });
    }
    const { fault, compensation_amount, resolution_note } = req.body || {};
    const managerId = req.user?.id || null;

    if (!fault) {
      return res.status(400).json({ message: 'Vui lòng xác định bên có lỗi (Công ty, Khách hàng, Bên thứ ba).' });
    }

    const hasCompAmount =
      compensation_amount !== undefined &&
      compensation_amount !== null &&
      String(compensation_amount).trim() !== '';
    const amountNum = hasCompAmount ? Number(compensation_amount) : 0;
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return res.status(400).json({ message: 'Số tiền bồi thường không hợp lệ (>= 0).' });
    }

    const existingInc = await prisma.incidents.findUnique({
      where: { id: BigInt(numId) },
      select: { id: true, status: true }
    });
    if (!existingInc) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }
    const existingStatusUpper = String(existingInc.status || '').toUpperCase();
    if (['DONE', 'CLOSED', 'PAID', 'RESOLVED'].includes(existingStatusUpper)) {
      return res.status(400).json({ message: 'Sự cố này đã được giải quyết hoặc đóng hồ sơ trước đó.' });
    }

    const nowDate = new Date();
    const actorBigId = managerId ? BigInt(managerId) : null;

    const updatedIncRow = await prisma.incidents.update({
      where: { id: BigInt(numId) },
      data: {
        fault: fault,
        resolution_note: resolution_note || 'Quản lý đã thẩm định và giải quyết sự cố.',
        status: 'RESOLVED',
        resolved_by: actorBigId,
        resolved_time: nowDate,
        ...(amountNum === 0 ? { closed_by: actorBigId, closed_at: nowDate } : {}),
        updated_at: nowDate
      },
      select: INCIDENT_SAFE_SELECT
    });
    const updatedInc = serializePrisma(updatedIncRow);

    //: Nếu số tiền bồi thường > 0, tự động sinh Yêu cầu bồi thường (Compensation Claim) ở trạng thái PENDING
    let createdClaim = null;
    if (amountNum > 0) {
      const existingClaim = await prisma.compensation_claims.findFirst({
        where: { incident_id: BigInt(numId) },
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
          console.warn(`[resolveIncident] Không tìm thấy order_id cho sự cố #${numId} (trip_id=${updatedInc.trip_id}), bỏ qua tự động tạo compensation_claim.`);
        } else {
          try {
            const newClaimRow = await prisma.compensation_claims.create({
              data: {
                incident_id: BigInt(numId),
                order_id: BigInt(orderId),
                source: 'INCIDENT',
                amount: BigInt(Math.round(amountNum)),
                reason: `Bồi thường phát sinh từ sự cố INC-${String(numId).padStart(3, '0')}: ${resolution_note || updatedInc.description || 'Lỗi vận hành'}`,
                status: 'PENDING',
                created_by: actorBigId
              }
            });
            createdClaim = serializePrisma(newClaimRow);
          } catch (claimErr) {
            console.error('Tự động tạo compensation_claim thất bại:', claimErr);
          }
        }
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: actorBigId,
          actor_type: 'MANAGER',
          action: 'RESOLVE_INCIDENT',
          target_type: 'INCIDENT',
          target_id: BigInt(numId),
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
 * Manager quyết định Xét duyệt hoặc Từ chối bồi thường (BF-04: APPROVED | REJECTED | IN_PROGRESS)
 * Áp dụng Option B (TC_IC_07-10 / BUG-SYS-32): Kiểm tra hạn mức contract liability_cap (mặc định 500M VNĐ),
 * trả về 400 (MSG56) nếu vượt hạn mức mà không có nhận xét/lý do ngoại lệ.
 */
const decideIncidentCompensation = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseIncidentIdParam(id);
    if (!numId) {
      return res.status(400).json({ message: 'Mã sự cố không hợp lệ.' });
    }
    const {
      action, // 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO'
      fault,
      approved_amount,
      damage_percentage,
      goods_handling_method,
      contract_clause_ref,
      survey_org_report,
      rejection_reason,
      contact_hotline,
      resolution_note
    } = req.body || {};
    const managerId = req.user?.id || 1;

    const normalizedAction = String(action || '').trim().toUpperCase();
    if (!['APPROVE', 'REJECT', 'REQUEST_MORE_INFO'].includes(normalizedAction)) {
      return res.status(400).json({
        message: 'Hành động xét duyệt không hợp lệ (chỉ nhận APPROVE, REJECT hoặc REQUEST_MORE_INFO).'
      });
    }

    const isRequestMoreInfo = normalizedAction === 'REQUEST_MORE_INFO';
    const isApprove = normalizedAction === 'APPROVE';
    // Theo BF-04: Approve/Reject giữ trạng thái APPROVED / REJECTED để Điều phối viên gọi điện cho khách hàng trước khi chuyển bước tiếp theo
    let targetStatus = isApprove ? 'APPROVED' : 'REJECTED';
    if (isRequestMoreInfo) targetStatus = 'IN_PROGRESS';

    if (!isApprove && !isRequestMoreInfo) {
      if (!rejection_reason || !String(rejection_reason).trim()) {
        return res.status(400).json({ message: 'Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.' });
      }
      if (!contract_clause_ref || !String(contract_clause_ref).trim()) {
        return res.status(400).json({ message: 'Bắt buộc viện dẫn điều khoản hợp đồng áp dụng khi từ chối bồi thường.' });
      }
    }

    let approvedNum = 0;
    if (isApprove) {
      const hasApprovedInput =
        approved_amount !== undefined &&
        approved_amount !== null &&
        String(approved_amount).trim() !== '';
      approvedNum = hasApprovedInput ? Number(approved_amount) : NaN;
      if (!hasApprovedInput || !Number.isFinite(approvedNum) || approvedNum <= 0) {
        return res.status(400).json({ message: 'Số tiền phê duyệt bồi thường phải lớn hơn 0 VNĐ.' });
      }
    }

    const bigIncId = BigInt(numId);
    const existingInc = await prisma.incidents.findUnique({
      where: { id: bigIncId },
      select: {
        id: true,
        status: true,
        trip_id: true,
        type: true,
        reported_by: true,
        compensation_claims: { select: { id: true, status: true }, orderBy: { id: 'desc' } }
      }
    });
    if (!existingInc) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }

    const curStatusUpper = String(existingInc.status || '').toUpperCase();
    const hasPendingClaim = (existingInc.compensation_claims || []).some(
      (c) => String(c.status || '').toUpperCase() === 'PENDING'
    );
    if (['APPROVED', 'PAID', 'DONE', 'CLOSED', 'REJECTED', 'RESOLVED'].includes(curStatusUpper) && !hasPendingClaim) {
      return res.status(400).json({ message: 'Sự cố này đã được ra quyết định trước đó, không thể xét duyệt lại.' });
    }

    if (isApprove) {
      // Kiểm tra hạn mức trách nhiệm của hợp đồng (BR-37 / Option B - MSG56)
      let liabilityLimit = 500000000;
      if (existingInc.trip_id) {
        const stopOrder = await prisma.trip_stops.findFirst({
          where: { trip_id: BigInt(existingInc.trip_id), order_id: { not: null } },
          select: {
            orders: {
              select: {
                customer_id: true,
                contract_id: true,
                transport_contracts: { select: { liability_cap: true } }
              }
            }
          }
        });
        let contractCap = Number(stopOrder?.orders?.transport_contracts?.liability_cap || 0);
        if (!contractCap && stopOrder?.orders?.customer_id) {
          const activeContract = await prisma.transport_contracts.findFirst({
            where: {
              customer_id: BigInt(stopOrder.orders.customer_id),
              status: { in: ['ACTIVE', 'Active'] }
            },
            orderBy: { id: 'desc' },
            select: { liability_cap: true }
          });
          contractCap = Number(activeContract?.liability_cap || 0);
        }
        if (contractCap > 0) {
          liabilityLimit = contractCap;
        }
      }

      const justificationText = String(resolution_note || req.body?.comment || '').trim();
      if (approvedNum > liabilityLimit && !justificationText) {
        return res.status(400).json({
          message: `Số tiền duyệt (${approvedNum.toLocaleString('vi-VN')} đ) vượt hạn mức trách nhiệm (${liabilityLimit.toLocaleString('vi-VN')} đ). Bắt buộc nhập nhận xét/lý do phê duyệt ngoại lệ (MSG56).`
        });
      }
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const managerBigId = BigInt(managerInt);
    const approvedRounded = isApprove ? Math.round(approvedNum) : 0;
    const resolutionNoteFull = resolution_note || (
      isApprove
        ? `Quản lý đã phê duyệt bồi thường ${approvedRounded.toLocaleString('vi-VN')} đ theo ${contract_clause_ref || 'Hợp đồng vận tải'}. (Hư hỏng: ${damage_percentage || 0}%, xử lý: ${goods_handling_method || 'Khách giữ'})`
        : isRequestMoreInfo
        ? 'Quản lý yêu cầu bổ sung thêm hồ sơ / biên bản giám định hiện trường.'
        : `Từ chối bồi thường theo ${contract_clause_ref || 'Hợp đồng'}. Lý do: ${rejection_reason}`
    );

    const extendedMetadata = {
      ...(damage_percentage !== undefined && damage_percentage !== null ? { damage_percentage: Number(damage_percentage) } : {}),
      ...(goods_handling_method ? { goods_handling_method } : {}),
      ...(contract_clause_ref ? { contract_clause_ref } : {}),
      approved_compensation_amount: approvedRounded,
      rejection_reason: (!isApprove && !isRequestMoreInfo) ? String(rejection_reason).trim() : null,
      contact_hotline: contact_hotline || '1900 1234'
    };

    const corePayload = {
      fault: fault || (isApprove ? 'COMPANY' : 'CUSTOMER'),
      resolution_note: String(resolutionNoteFull || '').slice(0, 500),
      status: targetStatus,
      resolved_by: managerBigId,
      resolved_time: nowDate,
      updated_at: nowDate,
      ...(damage_percentage !== undefined && damage_percentage !== null ? { damage_percentage: Number(damage_percentage) } : {}),
      ...(goods_handling_method ? { goods_handling_method } : {}),
      ...(contract_clause_ref ? { contract_clause_ref } : {}),
      approved_compensation_amount: BigInt(approvedRounded),
      rejection_reason: (!isApprove && !isRequestMoreInfo) ? String(rejection_reason).trim() : null,
      contact_hotline: contact_hotline || '1900 1234'
    };

    const updatedIncRow = await prisma.incidents.update({
      where: { id: bigIncId },
      data: corePayload,
      select: INCIDENT_SAFE_SELECT
    });
    const updatedInc = serializePrisma(updatedIncRow);

    // Đồng bộ hoặc tạo mới bản ghi trong bảng compensation_claims theo chuẩn BF-04
    const claimStatus = isApprove ? 'APPROVED' : isRequestMoreInfo ? 'PENDING' : 'REJECTED';
    const approvedClaimAmount = BigInt(approvedRounded);
    const existingClaims = existingInc.compensation_claims || [];
    let resolvedClaimId = existingClaims[0]?.id ? Number(existingClaims[0].id) : null;

    if (existingClaims.length > 0) {
      try {
        await prisma.compensation_claims.updateMany({
          where: { incident_id: bigIncId },
          data: {
            status: claimStatus,
            approved_amount: approvedClaimAmount,
            outcome: goods_handling_method || (isApprove ? 'CUSTOMER_RETAIN' : null),
            damage_percentage: damage_percentage !== undefined && damage_percentage !== null ? Number(damage_percentage) : null,
            assessment_result: survey_org_report || null,
            contract_clause_ref: contract_clause_ref || null,
            rejection_reason: (!isApprove && !isRequestMoreInfo) ? String(rejection_reason).trim() : null,
            contact_hotline: contact_hotline || '1900 1234',
            reviewed_by: managerBigId,
            reviewed_time: nowDate,
            review_comment: resolutionNoteFull,
            updated_at: nowDate
          }
        });
      } catch (claimUpdErr) {
        console.warn('compensation_claims update warning:', claimUpdErr.message);
      }
    } else {
      const tripIdToLookup = updatedInc?.trip_id || (existingInc.trip_id ? Number(existingInc.trip_id) : null);
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
        console.warn(`[decideIncidentCompensation] Không tìm thấy order_id cho sự cố #${numId} (trip_id=${tripIdToLookup}), bỏ qua tạo compensation_claim.`);
      } else {
        try {
          const createdClaimRow = await prisma.compensation_claims.create({
            data: {
              incident_id: bigIncId,
              order_id: BigInt(orderId),
              source: 'INCIDENT',
              amount: approvedClaimAmount,
              approved_amount: approvedClaimAmount,
              outcome: goods_handling_method || (isApprove ? 'CUSTOMER_RETAIN' : null),
              damage_percentage: damage_percentage !== undefined && damage_percentage !== null ? Number(damage_percentage) : null,
              assessment_result: survey_org_report || null,
              contract_clause_ref: contract_clause_ref || null,
              rejection_reason: (!isApprove && !isRequestMoreInfo) ? String(rejection_reason).trim() : null,
              contact_hotline: contact_hotline || '1900 1234',
              reason: resolutionNoteFull,
              status: claimStatus,
              created_by: managerBigId,
              reviewed_by: managerBigId,
              reviewed_time: nowDate,
              review_comment: resolutionNoteFull,
              updated_at: nowDate
            },
            select: { id: true }
          });
          resolvedClaimId = Number(createdClaimRow.id);
        } catch (claimInsErr) {
          console.warn('compensation_claims insert warning:', claimInsErr.message);
        }
      }
    }

    // Gửi Email thông báo kết quả Duyệt / Từ chối bồi thường tới Khách hàng (chỉ khi có email thật)
    let emailResult = { sent: false, customer_email: null, email_type: null, email_sent_at: null };
    if (!isRequestMoreInfo) {
      try {
        const tripIdForEmail = updatedInc?.trip_id || (existingInc.trip_id ? Number(existingInc.trip_id) : null);
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
          meta?.contract_details?.customer_email ||
          null;
        const customerName =
          orderForEmail?.customer?.company_name ||
          orderForEmail?.receiver_name ||
          'Quý khách hàng';
        const contactPerson =
          orderForEmail?.customer?.contact_person ||
          orderForEmail?.receiver_name ||
          '';
        const orderCode = orderForEmail?.order_code || `NEX-${numId}`;
        const cargoDescription = firstCargo?.cargo_name
          ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
          : 'Hàng hóa theo vận đơn';
        const declaredValue = Number(firstCargo?.declared_value || 0);
        const incidentCode = `INC-${String(numId).padStart(3, '0')}`;
        const claimCode = resolvedClaimId
          ? `CLM-${String(resolvedClaimId).padStart(4, '0')}`
          : incidentCode;
        const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
        const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
        const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

        if (customerEmail) {
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
              incidentType: updatedInc?.type || existingInc.type || 'Sự cố vận chuyển hàng hóa',
              cargoDescription,
              declaredValue,
              damagePercentage: damage_percentage || 0,
              approvedAmount: approvedRounded,
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
              incidentType: updatedInc?.type || existingInc.type || 'Sự cố vận chuyển hàng hóa',
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
        }
      } catch (mailErr) {
        console.warn('Gửi email quyết định bồi thường warning:', mailErr.message);
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerBigId,
          actor_type: 'MANAGER',
          action: isApprove ? 'APPROVE_INCIDENT_COMPENSATION' : isRequestMoreInfo ? 'REQUEST_MORE_INFO_INCIDENT' : 'REJECT_INCIDENT_COMPENSATION',
          target_type: 'INCIDENT',
          target_id: bigIncId,
          changes: {
            fault: corePayload.fault,
            status: targetStatus,
            resolution_note: corePayload.resolution_note,
            resolved_by: managerInt,
            resolved_time: now,
            updated_at: now,
            ...extendedMetadata,
            claim_id: resolvedClaimId,
            email_sent: emailResult.sent,
            customer_email: emailResult.customer_email,
            email_type: emailResult.email_type,
            email_sent_at: emailResult.email_sent_at
          },
          reason: String(isApprove ? resolutionNoteFull : isRequestMoreInfo ? resolutionNoteFull : rejection_reason || '').slice(0, 255),
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    // Gửi thông báo tới Điều phối viên (role_id = 3) và Tài xế báo sự cố
    try {
      const incidentCode = `INC-${String(numId).padStart(3, '0')}`;
      const notifyMsg = isApprove
        ? `[${incidentCode}] Quản lý đã phê duyệt bồi thường ${approvedRounded.toLocaleString('vi-VN')} đ và gửi email tới khách hàng. Vui lòng Điều phối viên gọi điện xác nhận với khách hàng.`
        : isRequestMoreInfo
          ? `[${incidentCode}] Quản lý yêu cầu bổ sung hồ sơ/minh chứng: ${resolution_note || 'Kiểm tra chi tiết sự cố.'}`
          : `[${incidentCode}] Quản lý đã từ chối bồi thường theo ${contract_clause_ref || 'hợp đồng'}. Vui lòng Điều phối viên gọi điện thông báo khách hàng để đóng hồ sơ.`;

      const recipientIds = new Set();
      const dispatchers = await prisma.users.findMany({
        where: { role_id: 3n },
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
          target_id: bigIncId,
          message: notifyMsg,
          created_time: nowDate
        }));
        await prisma.notifications.createMany({ data: notifRows });
      }
    } catch (notifyErr) {
      console.warn('notify decideIncidentCompensation warning:', notifyErr.message);
    }

    const msg = isApprove
      ? `Đã phê duyệt bồi thường ${approvedRounded.toLocaleString('vi-VN')} đ${emailResult.sent ? ` và gửi email tới ${emailResult.customer_email}` : ''} — Chờ Điều phối viên gọi điện khách hàng.`
      : isRequestMoreInfo
      ? 'Đã gửi yêu cầu bổ sung hồ sơ tới Điều phối viên & Khách hàng thành công.'
      : `Đã từ chối bồi thường${emailResult.sent ? ` và gửi email thông báo tới ${emailResult.customer_email}` : ''} — Chờ Điều phối viên gọi điện thông báo khách hàng.`;

    return res.json({
      message: msg,
      incident: { ...updatedInc, ...extendedMetadata, claim_id: resolvedClaimId },
      email_result: emailResult
    });
  } catch (error) {
    console.error('decideIncidentCompensation Error:', error);
    return res.status(500).json({ message: 'Lỗi khi ra quyết định bồi thường sự cố', error: error.message });
  }
};

/**
 * Manager ghi nhận đã thanh toán tiền bồi thường & chứng từ chuyển khoản (APPROVED -> PAID, chờ khách xác nhận)
 */
const closeIncidentCase = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseIncidentIdParam(id);
    if (!numId) {
      return res.status(400).json({ message: 'Mã sự cố không hợp lệ.' });
    }
    const { payment_proof_url, close_note, payment_date, transaction_code, approved_amount } = req.body || {};
    const managerId = req.user?.id || 1;

    const noteInput = String(close_note || '').trim();
    const txMatch = noteInput.match(/Mã GD:\s*([A-Za-z0-9_-]+)/i);
    const txCode = String(transaction_code || (txMatch ? txMatch[1] : '') || '').trim();

    if (!txCode) {
      return res.status(400).json({ message: 'Vui lòng nhập mã giao dịch ngân hàng (UNC).' });
    }
    if (!payment_proof_url || !String(payment_proof_url).trim()) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ảnh biên lai / chứng từ chuyển khoản ngân hàng.' });
    }

    const bigIncId = BigInt(numId);
    const existingInc = await prisma.incidents.findUnique({
      where: { id: bigIncId },
      select: { id: true, status: true, trip_id: true, resolution_note: true, approved_compensation_amount: true }
    });
    if (!existingInc) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }

    const existingClaims = await prisma.compensation_claims.findMany({
      where: { incident_id: bigIncId },
      select: { id: true, status: true, amount: true, approved_amount: true, order_id: true, called_at: true },
      orderBy: { id: 'desc' }
    });

    const incStatusUpper = String(existingInc.status || '').toUpperCase();
    const primaryClaim = existingClaims[0] || null;
    const claimStatusUpper = String(primaryClaim?.status || '').toUpperCase();
    const isApprovedState =
      claimStatusUpper === 'APPROVED' ||
      (incStatusUpper === 'APPROVED' && (!primaryClaim || claimStatusUpper === 'APPROVED'));
    if (!isApprovedState) {
      return res.status(400).json({
        message: 'Chỉ có thể ghi nhận thanh toán cho sự cố/khiếu nại đang ở trạng thái APPROVED.'
      });
    }
    if (primaryClaim && !primaryClaim.called_at) {
      return res.status(400).json({
        message: 'Điều phối viên chưa ghi nhận cuộc gọi thông báo khách hàng. Cần hoàn tất bước gọi khách trước khi ghi nhận thanh toán.'
      });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const managerInt = Number(managerId || 1);
    const managerBigId = BigInt(managerInt);
    const proofStr = await cloudinaryService.uploadDataUriIfNeeded(payment_proof_url, 'nexlog/claims');
    const dateMatch = noteInput.match(/ngày\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);

    const payDate = payment_date || (dateMatch ? dateMatch[1] : now.split('T')[0]);
    let parsedPaymentDate = nowDate;
    if (payDate) {
      const candidate = new Date(
        String(payDate).includes('T') ? payDate : `${String(payDate).trim()}T00:00:00.000Z`
      );
      if (!Number.isNaN(candidate.getTime())) {
        parsedPaymentDate = candidate;
      }
    }
    const closeNoteFull = noteInput || `Đã chi tiền bồi thường ngày ${payDate}. Mã GD: ${txCode}`;

    const resolvedPaidAmount = Number(
      approved_amount ||
      primaryClaim?.approved_amount ||
      primaryClaim?.amount ||
      existingInc.approved_compensation_amount ||
      0
    );

    const prevNote = existingInc.resolution_note ? `${existingInc.resolution_note} | ` : '';
    const mergedNote = `${prevNote}[ĐÃ CHI TIỀN - Ngày: ${payDate} | Mã GD: ${txCode}]`.slice(0, 500);

    const corePaidPayload = {
      status: 'PAID',
      payment_proof_url: proofStr,
      resolution_note: mergedNote,
      resolved_by: managerBigId,
      resolved_time: nowDate,
      updated_at: nowDate
    };

    const updatedIncRow = await prisma.incidents.update({
      where: { id: bigIncId },
      data: corePaidPayload,
      select: INCIDENT_SAFE_SELECT
    });
    const updatedInc = serializePrisma(updatedIncRow);

    // Cập nhật hoặc tạo mới compensation_claims ở trạng thái PAID (chờ khách hàng xác nhận hoặc JOB-08 tự đóng sau 7 ngày)
    let claimIdForEmail = primaryClaim?.id ? Number(primaryClaim.id) : null;
    let orderIdForEmail = primaryClaim?.order_id ? Number(primaryClaim.order_id) : null;

    if (existingClaims.length > 0) {
      await prisma.compensation_claims.updateMany({
        where: { incident_id: bigIncId },
        data: {
          status: 'PAID',
          paid_by: managerBigId,
          paid_at: nowDate,
          payment_date: parsedPaymentDate,
          transaction_code: txCode.slice(0, 100),
          payment_proof_url: proofStr,
          payment_note: closeNoteFull,
          closed_at: null,
          reviewed_by: managerBigId,
          reviewed_time: nowDate,
          updated_at: nowDate,
          ...(resolvedPaidAmount > 0 ? { approved_amount: BigInt(Math.round(resolvedPaidAmount)) } : {})
        }
      });
    } else {
      let orderId = null;
      const tripIdToLookup = updatedInc?.trip_id || (existingInc.trip_id ? Number(existingInc.trip_id) : null);
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
        console.warn(`[closeIncidentCase] Không tìm thấy order_id cho sự cố #${numId} (trip_id=${tripIdToLookup}), bỏ qua tạo compensation_claim.`);
      } else {
        orderIdForEmail = Number(orderId);
        const createdClaim = await prisma.compensation_claims.create({
          data: {
            incident_id: bigIncId,
            order_id: BigInt(orderId),
            source: 'INCIDENT',
            amount: BigInt(Math.round(resolvedPaidAmount)),
            approved_amount: BigInt(Math.round(resolvedPaidAmount)),
            reason: closeNoteFull,
            payment_proof_url: proofStr,
            transaction_code: txCode.slice(0, 100),
            payment_date: parsedPaymentDate,
            payment_note: closeNoteFull,
            paid_by: managerBigId,
            paid_at: nowDate,
            status: 'PAID',
            created_by: managerBigId,
            reviewed_by: managerBigId,
            reviewed_time: nowDate,
            updated_at: nowDate
          }
        });
        claimIdForEmail = Number(createdClaim.id);
      }
    }

    // Gửi email thông báo đã chuyển khoản cho khách hàng vào xác nhận (BF-04)
    if (orderIdForEmail) {
      try {
        const ord = await prisma.orders.findUnique({
          where: { id: BigInt(orderIdForEmail) },
          select: {
            order_code: true,
            tracking_token: true,
            receiver_name: true,
            order_notes: true,
            customers: { select: { company_name: true, contact_person: true, email: true } }
          }
        });
        const meta = ord ? parseOrderMeta(ord) : {};
        const customerEmail = ord?.customers?.email || meta?.customer_email || null;
        if (customerEmail) {
          const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
          const trackingToken = (ord?.tracking_token || ord?.order_code || '').trim();
          const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;
          await sendClaimPaymentRecordedEmail({
            customerEmail,
            customerName: ord?.customers?.company_name || ord?.receiver_name || 'Quý khách hàng',
            contactPerson: ord?.customers?.contact_person || ord?.receiver_name || '',
            orderCode: ord?.order_code || `ORDER-${orderIdForEmail}`,
            claimCode: claimIdForEmail ? `CLM-${String(claimIdForEmail).padStart(4, '0')}` : `INC-${String(numId).padStart(3, '0')}`,
            approvedAmount: resolvedPaidAmount,
            paymentDate: formatDateOnly(parsedPaymentDate) || payDate,
            transactionCode: txCode,
            paymentProofUrl: proofStr,
            paymentNote: closeNoteFull,
            trackingUrl
          });
        }
      } catch (mailErr) {
        console.warn('[closeIncidentCase] sendClaimPaymentRecordedEmail warning:', mailErr.message);
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerBigId,
          actor_type: 'MANAGER',
          action: 'RECORD_INCIDENT_PAYMENT',
          target_type: 'INCIDENT',
          target_id: bigIncId,
          changes: {
            status: 'PAID',
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
      message: 'Đã ghi nhận thanh toán bồi thường (PAID). Đang chờ khách hàng xác nhận nhận tiền (tự đóng sau 7 ngày).',
      incident: {
        ...updatedInc,
        status: 'PAID',
        claim_status: 'PAID',
        payment_date: payDate,
        transaction_code: txCode,
        payment_proof_url: proofStr,
        payment_note: closeNoteFull,
        approved_compensation_amount: resolvedPaidAmount
      }
    });
  } catch (error) {
    console.error('closeIncidentCase Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi ghi nhận thanh toán bồi thường', error: error.message });
  }
};

module.exports = {
  resolveIncident,
  decideIncidentCompensation,
  closeIncidentCase
};
