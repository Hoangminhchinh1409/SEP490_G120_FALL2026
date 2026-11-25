const prisma = require('../../config/prisma');
const claimService = require('../../services/claimService');
const { serializePrisma } = require('../../utils/prismaHelper');
const { parseOrderMeta } = require('../../services/orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail
} = require('../../services/emailService');
const {
  INCIDENT_SAFE_SELECT,
  CLAIM_TYPE_DISPLAY_MAP,
  mapOrderSummaryAliases,
  mapIncidentRelations
} = require('./incidentHelper');

const getClaims = async (req, res) => {
  try {
    const rawClaims = await prisma.compensation_claims.findMany({
      orderBy: { id: 'desc' },
      include: {
        incidents: {
          select: {
            id: true,
            type: true,
            fault: true,
            description: true,
            photos: true,
            status: true,
            reported_time: true,
            trip_id: true,
            trips: {
              select: {
                id: true,
                trip_code: true,
                status: true,
                trip_trucks: { select: { trucks: { select: { plate_number: true } } } },
                trip_drivers: {
                  select: {
                    driver_profiles: {
                      select: { users: { select: { full_name: true, phone: true } } }
                    }
                  }
                }
              }
            }
          }
        },
        orders: {
          select: {
            id: true,
            order_code: true,
            order_type: true,
            agreed_price: true,
            customer_id: true,
            receiver_name: true
          }
        }
      }
    });

    const claims = (serializePrisma(rawClaims) || []).map((c) => ({
      ...c,
      decided_by: c.reviewed_by,
      decided_at: c.reviewed_time,
      decision_comment: c.review_comment,
      created_at: c.created_time,
      order: c.orders || null,
      incident: c.incidents
        ? {
            ...c.incidents,
            trip: c.incidents.trips
              ? {
                  ...c.incidents.trips,
                  trip_trucks: (c.incidents.trips.trip_trucks || []).map((tt) => ({
                    ...tt,
                    truck: tt.trucks || null
                  })),
                  trip_drivers: (c.incidents.trips.trip_drivers || []).map((td) => ({
                    ...td,
                    driver: td.driver_profiles
                      ? { ...td.driver_profiles, user: td.driver_profiles.users || null }
                      : null
                  }))
                }
              : null
          }
        : null
    }));

    const rawContracts = await prisma.transport_contracts.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, customer_id: true, liability_cap: true, status: true }
    });
    const contracts = serializePrisma(rawContracts) || [];

    const contractMap = {};
    (contracts || []).forEach((c) => {
      if (c.customer_id) {
        contractMap[c.customer_id] = Number(c.liability_cap || 0);
      }
    });

    const formattedClaims = (claims || []).map((c) => {
      const order = c.order;
      const incident = c.incident;
      const customerId = order?.customer_id;
      const contractCap = customerId && contractMap[customerId] ? contractMap[customerId] : 0;
      const declaredValue = Number(order?.agreed_price || 0) * 10;

      //: Giới hạn trách nhiệm = min(Contract Cap, Declared Value) hoặc 500M VNĐ
      let liabilityLimit = 500000000;
      if (contractCap > 0 && declaredValue > 0) {
        liabilityLimit = Math.min(contractCap, declaredValue);
      } else if (contractCap > 0) {
        liabilityLimit = contractCap;
      } else if (declaredValue > 0) {
        liabilityLimit = declaredValue;
      }

      const isExceedingCap = Number(c.amount || 0) > liabilityLimit;

      const incidentCode = incident?.id ? `INC-${String(incident.id).padStart(3, '0')}` : null;

      let sourceDisplay = 'Sự cố vận chuyển';
      if (c.source === 'CUSTOMER_CLAIM') {
        sourceDisplay = 'Khách hàng khiếu nại (Tracking Portal)';
      } else if (c.source === 'DISPATCHER_ESCALATED') {
        sourceDisplay = 'ĐPV chuyển tiếp sự cố nghiêm trọng';
      } else if (c.source === 'DRIVER_REPORTED') {
        sourceDisplay = 'Tài xế báo cáo sự cố hiện trường';
      } else if (incidentCode) {
        sourceDisplay = `Sự cố ${incidentCode}`;
      }

      const tripObj = incident?.trip;
      const truckPlate = tripObj?.trip_trucks?.[0]?.truck?.plate_number || null;
      const driverObj = tripObj?.trip_drivers?.[0]?.driver?.user;
      const driverName = driverObj?.full_name || null;
      const driverPhone = driverObj?.phone || null;

      let incidentPhotos = [];
      if (incident?.photos) {
        if (Array.isArray(incident.photos)) {
          incidentPhotos = incident.photos;
        } else if (typeof incident.photos === 'string') {
          try {
            incidentPhotos = JSON.parse(incident.photos);
          } catch {
            incidentPhotos = [incident.photos];
          }
        }
      }

      return {
        id: c.id,
        claim_code: `CLM-${String(c.id).padStart(4, '0')}`,
        order_id: c.order_id,
        order_code: order?.order_code || 'N/A',
        order_type: order?.order_type || 'Export',
        customer_id: customerId,
        receiver_name: order?.receiver_name || null,
        incident_id: c.incident_id,
        incident_code: incidentCode,
        incident_type: incident?.type || null,
        incident_type_display: incident?.type ? (CLAIM_TYPE_DISPLAY_MAP[incident.type] || incident.type) : 'Sự cố vận tải',
        incident_fault: incident?.fault || 'COMPANY',
        incident_description: incident?.description || '',
        incident_status: incident?.status || null,
        incident_photos: incidentPhotos,
        incident_reported_time: incident?.reported_time || null,
        trip_id: incident?.trip_id || tripObj?.id || null,
        trip_code: tripObj?.trip_code || (incident?.trip_id ? `TRIP-${incident.trip_id}` : null),
        truck_plate: truckPlate,
        driver_name: driverName,
        driver_phone: driverPhone,
        source: c.source || 'INCIDENT',
        source_display: sourceDisplay,
        amount: Number(c.amount || 0),
        reason: c.reason,
        status: c.status || 'PENDING',
        decided_by: c.decided_by,
        decided_at: c.decided_at,
        decision_comment: c.decision_comment,
        contract_cap: contractCap,
        declared_value: declaredValue,
        liability_limit: liabilityLimit,
        is_exceeding_cap: isExceedingCap,
        created_at: c.created_at
      };
    });

    let extraFees = [];
    try {
      const rawExtraFees = await prisma.extra_fees.findMany({
        orderBy: { id: 'desc' },
        include: {
          orders: { select: { id: true, order_code: true, receiver_name: true } },
          trips: { select: { id: true, trip_code: true } }
        }
      });
      extraFees = (serializePrisma(rawExtraFees) || []).map((ef) => ({
        ...ef,
        id: ef.id,
        type: 'EXTRA_FEE',
        fee_type: ef.fee_type,
        order_id: ef.order_id,
        order_code: ef.orders?.order_code || 'N/A',
        trip_id: ef.trip_id,
        trip_code: ef.trips?.trip_code || null,
        amount: Number(ef.amount || 0),
        reason: ef.reason,
        status: ef.status || 'Proposed'
      }));
    } catch (efErr) {
      console.warn('getClaims extra_fees query warning:', efErr.message);
    }

    return res.json({
      claims: formattedClaims,
      extra_fees: extraFees,
      approvals: [...extraFees, ...formattedClaims],
      summary: {
        total: formattedClaims.length,
        pending: formattedClaims.filter((x) => x.status === 'PENDING').length,
        approved: formattedClaims.filter((x) => x.status === 'APPROVED').length,
        rejected: formattedClaims.filter((x) => x.status === 'REJECTED').length
      }
    });
  } catch (error) {
    console.error('getClaims Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách khiếu nại bồi thường', error: error.message });
  }
};

const decideClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment, note } = req.body;
    const managerId = req.user?.id || null;

    const decisionText = comment || note;
    const isApprove = action === 'APPROVE' || action === 'Approve';
    const targetStatus = isApprove ? 'APPROVED' : 'REJECTED';

    const rawClaim = await prisma.compensation_claims.findUnique({
      where: { id: BigInt(id) }
    });

    if (!rawClaim) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu bồi thường.' });
    }
    const claim = serializePrisma(rawClaim);

    if (!isApprove && !decisionText) {
      return res.status(400).json({ message: 'Bắt buộc nhập lý do/nhận xét khi từ chối bồi thường.' });
    }

    const nowDate = new Date();
    const reviewerInt = managerId ? Number(managerId) : null;
    const commentStr = decisionText || (isApprove ? 'Phê duyệt bồi thường hợp lệ.' : 'Từ chối bồi thường.');

    const updatedClaimRow = await prisma.compensation_claims.update({
      where: { id: BigInt(id) },
      data: {
        status: targetStatus,
        reviewed_by: reviewerInt,
        reviewed_time: nowDate,
        review_comment: commentStr,
        updated_at: nowDate
      }
    });
    const serializedClaim = serializePrisma(updatedClaimRow);
    const updatedClaim = {
      ...serializedClaim,
      decided_by: serializedClaim.reviewed_by,
      decided_at: serializedClaim.reviewed_time,
      decision_comment: serializedClaim.review_comment
    };

    if (claim.incident_id) {
      try {
        await prisma.incidents.update({
          where: { id: BigInt(claim.incident_id) },
          data: {
            status: isApprove ? 'RESOLVED' : 'CLOSED',
            updated_at: nowDate
          },
          select: { id: true }
        });
      } catch (incErr) {
        await prisma.incidents.update({
          where: { id: BigInt(claim.incident_id) },
          data: {
            status: 'RESOLVED',
            updated_at: nowDate
          },
          select: { id: true }
        }).catch(() => {});
      }
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: reviewerInt,
          actor_type: 'MANAGER',
          action: isApprove ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
          target_type: 'COMPENSATION_CLAIM',
          target_id: BigInt(id),
          changes: { status: targetStatus, amount: Number(claim.amount || 0) },
          reason: decisionText || null,
          created_time: nowDate
        }
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    const msg = isApprove
      ? `Đã phê duyệt yêu cầu bồi thường ${claim.amount?.toLocaleString('vi-VN')} đ.`
      : 'Đã từ chối yêu cầu bồi thường thành công.';

    return res.json({ message: msg, claim: updatedClaim });
  } catch (error) {
    console.error('decideClaim Error:', error);
    return res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu bồi thường', error: error.message });
  }
};

const sendIncidentDecisionEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email_type, // 'APPROVAL' | 'REJECTION'
      customer_email: bodyCustomerEmail,
      approved_amount,
      damage_percentage,
      goods_handling_method,
      contract_clause_ref,
      survey_org_report,
      resolution_note,
      rejection_reason,
      contact_hotline
    } = req.body || {};
    const managerId = req.user?.id || 1;

    const rawIncident = await prisma.incidents.findUnique({
      where: { id: BigInt(id) },
      select: {
        ...INCIDENT_SAFE_SELECT,
        trips: { select: { id: true, trip_code: true } },
        compensation_claims: true
      }
    });

    if (!rawIncident) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sự cố.' });
    }
    const incident = mapIncidentRelations(rawIncident);

    let orderForEmail = null;
    if (incident.trip_id) {
      const stop = await prisma.trip_stops.findFirst({
        where: {
          trip_id: BigInt(incident.trip_id),
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
      });
      orderForEmail = stop?.orders ? mapOrderSummaryAliases(stop.orders) : null;
    }

    const meta = orderForEmail ? parseOrderMeta(orderForEmail) : {};
    const firstCargo = Array.isArray(orderForEmail?.order_cargos)
      ? orderForEmail.order_cargos[0]
      : orderForEmail?.order_cargos;
    const claim = Array.isArray(incident.compensation_claims)
      ? incident.compensation_claims[0]
      : incident.compensation_claims;

    const customerEmail =
      (bodyCustomerEmail && String(bodyCustomerEmail).trim()) ||
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
    const tripCode = incident.trip?.trip_code || `TRIP-${incident.trip_id}`;
    const cargoDescription = firstCargo?.cargo_name
      ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
      : 'Hàng hóa theo vận đơn';
    const declaredValue =
      Number(firstCargo?.declared_value || 0) ||
      Number(orderForEmail?.agreed_price || 0) * 10 ||
      120000000;
    const incidentCode = `INC-${String(id).padStart(3, '0')}`;
    const claimCode = claim?.id
      ? `CLM-${String(claim.id).padStart(4, '0')}`
      : `CLM-${String(id).padStart(4, '0')}`;
    const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
    const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

    const isRejectType =
      String(email_type || '').toUpperCase() === 'REJECTION' ||
      (!email_type && (Boolean(incident.rejection_reason) || String(claim?.status || '').toUpperCase() === 'REJECTED'));

    const finalAmount = Number(
      approved_amount ??
      incident.approved_compensation_amount ??
      claim?.amount ??
      0
    );

    let sendRes;
    if (isRejectType) {
      sendRes = await sendIncidentCompensationRejectionEmail({
        customerEmail,
        customerName,
        contactPerson,
        orderCode,
        tripCode,
        incidentCode,
        claimCode,
        incidentType: incident.type || 'Sự cố vận chuyển hàng hóa',
        cargoDescription,
        rejectionReason: rejection_reason || incident.rejection_reason || incident.resolution_note,
        rejectionClause: contract_clause_ref || incident.contract_clause_ref || 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng',
        resolutionNote: resolution_note || incident.resolution_note,
        contactHotline: contact_hotline || incident.contact_hotline || '1900 1234',
        trackingUrl
      });
    } else {
      sendRes = await sendIncidentCompensationApprovalEmail({
        customerEmail,
        customerName,
        contactPerson,
        orderCode,
        tripCode,
        incidentCode,
        claimCode,
        incidentType: incident.type || 'Sự cố vận chuyển hàng hóa',
        cargoDescription,
        declaredValue,
        damagePercentage: damage_percentage ?? incident.damage_percentage ?? 10,
        approvedAmount: finalAmount,
        goodsHandlingMethod: goods_handling_method || incident.goods_handling_method || 'CUSTOMER_RETAIN',
        contractClauseRef: contract_clause_ref || incident.contract_clause_ref || 'Điều 8.2 - Bồi thường thiệt hại hàng hóa',
        resolutionNote: resolution_note || incident.resolution_note,
        surveyOrgReport: survey_org_report || '',
        contactHotline: contact_hotline || incident.contact_hotline || '1900 1234',
        trackingUrl
      });
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const resolvedType = isRejectType ? 'REJECTION' : 'APPROVAL';
    if (sendRes?.success) {
      try {
        await prisma.activity_logs.create({
          data: {
            actor_id: Number(managerId || 1),
            actor_type: 'MANAGER',
            action: isRejectType ? 'REJECT_INCIDENT_COMPENSATION' : 'APPROVE_INCIDENT_COMPENSATION',
            target_type: 'INCIDENT',
            target_id: BigInt(id),
            changes: {
              email_sent: true,
              customer_email: customerEmail,
              email_type: resolvedType,
              email_sent_at: now,
              message_id: sendRes.messageId || null,
              approved_compensation_amount: finalAmount,
              damage_percentage: damage_percentage ?? incident.damage_percentage ?? 10,
              goods_handling_method: goods_handling_method || incident.goods_handling_method || 'CUSTOMER_RETAIN',
              contract_clause_ref: contract_clause_ref || incident.contract_clause_ref || null
            },
            reason: `Gửi email thông báo ${isRejectType ? 'từ chối' : 'phê duyệt'} bồi thường tới ${customerEmail}`.slice(0, 255),
            created_time: nowDate
          }
        });
      } catch (logErr) {
        console.warn('sendIncidentDecisionEmail activity_logs warning:', logErr.message);
      }
    }

    if (!sendRes?.success) {
      return res.status(500).json({
        success: false,
        message: sendRes?.error || 'Không thể gửi email tới khách hàng.'
      });
    }

    return res.json({
      success: true,
      message: `Đã gửi email thông báo tới ${customerEmail} thành công!`,
      email_result: {
        sent: true,
        customer_email: customerEmail,
        email_type: resolvedType,
        email_sent_at: now,
        message_id: sendRes.messageId || null,
        preview_url: sendRes.previewUrl || null
      }
    });
  } catch (error) {
    console.error('sendIncidentDecisionEmail Error:', error);
    return res.status(500).json({ message: 'Lỗi khi gửi email cho khách hàng', error: error.message });
  }
};

const createDispatcherClaim = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const claim = await claimService.createDispatcherClaim(req.body, userId);
    return res.status(201).json({
      message: `Đã tạo yêu cầu bồi thường ${claim.claim_code} và gửi thông báo tới Quản lý.`,
      claim
    });
  } catch (err) {
    console.error('createDispatcherClaim error:', err);
    return res.status(err.statusCode || 400).json({ message: err.message || 'Lỗi tạo yêu cầu bồi thường', error: err.message });
  }
};

const getClaimById = async (req, res) => {
  try {
    const claim = await claimService.getClaimById(req.params.id);
    return res.json({ claim });
  } catch (error) {
    console.error('getClaimById Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi lấy chi tiết yêu cầu bồi thường', error: error.message });
  }
};

const recordDispatcherClaimCall = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatcherId = req.user?.id || 1;
    const claim = await claimService.recordDispatcherCall(id, req.body, dispatcherId);
    const msg = claim.status === 'CLOSED_REJECTED'
      ? `Đã ghi nhận cuộc gọi thông báo từ chối cho khách và đóng hồ sơ ${claim.claim_code} (CLOSED_REJECTED).`
      : `Đã ghi nhận cuộc gọi với khách hàng cho ${claim.claim_code} — Quản lý có thể tiến hành ghi nhận thanh toán.`;
    return res.json({ message: msg, claim });
  } catch (error) {
    console.error('recordDispatcherClaimCall Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi ghi nhận cuộc gọi khách hàng', error: error.message });
  }
};

const recordManagerClaimPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user?.id || 1;
    const { claim, email_result } = await claimService.recordManagerPayment(id, req.body, managerId);
    return res.json({
      message: `Đã ghi nhận thanh toán bồi thường ${claim.claim_code} (Mã GD: ${claim.transaction_code})${email_result?.sent ? ` và gửi email tới ${email_result.customer_email}` : ''}. Chờ khách hàng xác nhận nhận tiền (tự đóng sau 7 ngày).`,
      claim,
      email_result
    });
  } catch (error) {
    console.error('recordManagerClaimPayment Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi ghi nhận thanh toán bồi thường', error: error.message });
  }
};

module.exports = {
  createDispatcherClaim,
  getClaims,
  getClaimById,
  decideClaim,
  recordDispatcherClaimCall,
  recordManagerClaimPayment,
  sendIncidentDecisionEmail
};
