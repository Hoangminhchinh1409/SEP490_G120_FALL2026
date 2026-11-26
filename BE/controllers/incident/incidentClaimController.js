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
  parseIncidentIdParam,
  mapOrderSummaryAliases,
  mapIncidentRelations
} = require('./incidentHelper');

const getClaims = async (req, res) => {
  try {
    const { claims: formattedClaims, summary } = await claimService.getAllClaimsForPortal();

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
      summary
    });
  } catch (error) {
    console.error('getClaims Error:', error);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách khiếu nại bồi thường', error: error.message });
  }
};

const decideClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user?.id || 1;
    const { claim, email_result } = await claimService.decideClaim(id, req.body, managerId);
    const isApprove = claim.status === 'APPROVED';
    const msg = isApprove
      ? `Đã phê duyệt bồi thường ${Number(claim.approved_amount || 0).toLocaleString('vi-VN')} đ${email_result?.sent ? ` và gửi email tới ${email_result.customer_email}` : ''} — Chờ Điều phối viên gọi điện khách hàng.`
      : `Đã từ chối yêu cầu bồi thường${email_result?.sent ? ` và gửi email tới ${email_result.customer_email}` : ''} — Chờ Điều phối viên gọi điện thông báo khách hàng.`;

    return res.json({ message: msg, claim, email_result });
  } catch (error) {
    console.error('decideClaim Error:', error);
    return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi khi xử lý yêu cầu bồi thường', error: error.message });
  }
};

const sendIncidentDecisionEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseIncidentIdParam(id);
    if (!numId) {
      return res.status(400).json({ message: 'Mã sự cố không hợp lệ.' });
    }
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
    const bigIncId = BigInt(numId);

    const rawIncident = await prisma.incidents.findUnique({
      where: { id: bigIncId },
      select: {
        ...INCIDENT_SAFE_SELECT,
        trips: { select: { id: true, trip_code: true } },
        compensation_claims: { orderBy: { id: 'desc' } }
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
      meta?.contract_details?.customer_email ||
      null;
    if (!customerEmail) {
      return res.status(400).json({ message: 'Đơn hàng chưa có email khách hàng để gửi thông báo.' });
    }

    const customerName =
      orderForEmail?.customer?.company_name ||
      orderForEmail?.receiver_name ||
      'Quý khách hàng';
    const contactPerson =
      orderForEmail?.customer?.contact_person ||
      orderForEmail?.receiver_name ||
      '';
    const orderCode = orderForEmail?.order_code || `NEX-${numId}`;
    const tripCode = incident.trip?.trip_code || `TRIP-${incident.trip_id}`;
    const cargoDescription = firstCargo?.cargo_name
      ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
      : 'Hàng hóa theo vận đơn';
    const declaredValue = Number(firstCargo?.declared_value || 0);
    const incidentCode = `INC-${String(numId).padStart(3, '0')}`;
    const claimCode = claim?.id
      ? `CLM-${String(claim.id).padStart(4, '0')}`
      : incidentCode;
    const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const trackingToken = (orderForEmail?.tracking_token || orderCode || '').trim();
    const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

    const isRejectType =
      String(email_type || '').toUpperCase() === 'REJECTION' ||
      (!email_type && (Boolean(incident.rejection_reason) || String(claim?.status || '').toUpperCase() === 'REJECTED'));

    const finalAmount = Number(
      approved_amount ??
      incident.approved_compensation_amount ??
      claim?.approved_amount ??
      claim?.amount ??
      0
    );
    const finalDamagePct = damage_percentage ?? incident.damage_percentage ?? 0;

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
        damagePercentage: finalDamagePct,
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
            actor_id: BigInt(managerId || 1),
            actor_type: 'MANAGER',
            action: 'SEND_INCIDENT_DECISION_EMAIL',
            target_type: 'INCIDENT',
            target_id: bigIncId,
            changes: {
              email_sent: true,
              customer_email: customerEmail,
              email_type: resolvedType,
              email_sent_at: now,
              message_id: sendRes.messageId || null,
              approved_compensation_amount: finalAmount,
              damage_percentage: finalDamagePct,
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
