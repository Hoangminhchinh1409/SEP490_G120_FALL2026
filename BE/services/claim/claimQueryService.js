const prisma = require('../../config/prisma');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../../utils/prismaHelper');
const {
  DEFAULT_CLAIM_WINDOW_DAYS,
  DEFAULT_LIABILITY_CAP,
  VALID_CLAIM_TYPES,
  DELIVERED_ORDER_STATUSES,
  INCIDENT_TYPE_DISPLAY_MAP,
  createHttpError,
  normalizeStatusKey,
  normalizeClaimType,
  parseJsonStringArray,
  getClaimWindowDays,
  uploadEvidencePhotos,
  notifyManagers,
  notifyDispatchers,
  getOrderDeliveredAt,
  parseEvidencePhotos,
  formatPublicClaim,
  getClaimRelationsInclude,
  formatDetailedClaim,
  buildOrderTokenWhere,
  getActiveContractMap,
  parseClaimIdParam
} = require('./claimHelper');

const createDispatcherClaim = async (payload = {}, userId = 1) => {
  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw createHttpError('Vui lòng nhập lý do / mô tả thiệt hại để tạo yêu cầu bồi thường.', 400);
  }

  const amountNum = payload.amount !== undefined && payload.amount !== null && payload.amount !== ''
    ? Number(payload.amount)
    : 0;
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    throw createHttpError('Số tiền yêu cầu bồi thường không hợp lệ (>= 0).', 400);
  }

  const claimType = normalizeClaimType(payload.claim_type);

  let resolvedIncidentId = null;
  let resolvedOrderId = payload.order_id ? toBigInt(payload.order_id) : null;

  if (payload.incident_id !== undefined && payload.incident_id !== null && String(payload.incident_id).trim() !== '') {
    const incIdNum = parseInt(String(payload.incident_id).replace(/^INC-/i, '').trim(), 10);
    if (!Number.isFinite(incIdNum) || incIdNum <= 0) {
      throw createHttpError('Mã sự cố không hợp lệ.', 400);
    }

    const incident = await prisma.incidents.findUnique({
      where: { id: BigInt(incIdNum) },
      select: {
        id: true,
        trip_id: true,
        trips: {
          select: {
            trip_stops: {
              where: { order_id: { not: null } },
              select: { order_id: true }
            }
          }
        }
      }
    });

    if (!incident) {
      throw createHttpError('Không tìm thấy sự cố liên quan.', 404);
    }
    resolvedIncidentId = incident.id;

    const tripOrderIds = [...new Set(
      (incident.trips?.trip_stops || [])
        .map((s) => s.order_id?.toString())
        .filter(Boolean)
    )];

    if (resolvedOrderId) {
      if (tripOrderIds.length > 0 && !tripOrderIds.includes(resolvedOrderId.toString())) {
        throw createHttpError('Đơn hàng được chọn không thuộc chuyến xe xảy ra sự cố này.', 400);
      }
    } else if (tripOrderIds.length === 1) {
      resolvedOrderId = BigInt(tripOrderIds[0]);
    } else {
      throw createHttpError('Vui lòng chọn đơn hàng bị ảnh hưởng trên chuyến xe.', 400);
    }
  }

  if (!resolvedOrderId) {
    throw createHttpError('Vui lòng chọn đơn hàng cần tạo yêu cầu bồi thường.', 400);
  }

  const order = await prisma.orders.findUnique({
    where: { id: resolvedOrderId },
    select: { id: true, order_code: true }
  });
  if (!order) {
    throw createHttpError('Không tìm thấy đơn hàng tương ứng.', 404);
  }

  const uploadedUrls = await uploadEvidencePhotos(payload.evidence_photos || payload.photos);
  const now = new Date();
  const actorBigId = toBigInt(userId || 1);

  const created = await prisma.compensation_claims.create({
    data: {
      order_id: order.id,
      incident_id: resolvedIncidentId,
      source: 'INCIDENT',
      claim_type: claimType,
      amount: BigInt(Math.round(amountNum)),
      reason,
      evidence_photos: uploadedUrls,
      evidence: uploadedUrls[0] || null,
      status: 'PENDING',
      created_by: actorBigId,
      updated_at: now
    }
  });

  const claimIdNum = toNum(created.id);
  const claimCode = `CLM-${String(claimIdNum).padStart(4, '0')}`;

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
        actor_type: 'DISPATCHER',
        action: 'CREATE_CLAIM_FROM_INCIDENT',
        target_type: 'COMPENSATION_CLAIM',
        target_id: created.id,
        changes: {
          claim_code: claimCode,
          order_id: toNum(order.id),
          order_code: order.order_code,
          incident_id: resolvedIncidentId ? toNum(resolvedIncidentId) : null,
          claim_type: claimType,
          amount: Math.round(amountNum),
          status: 'PENDING'
        },
        reason: reason.slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] createDispatcherClaim activity_logs warning:', logErr.message);
  }

  await notifyManagers({
    claimId: claimIdNum,
    claimCode,
    orderCode: order.order_code,
    sourceLabel: 'Điều phối viên (sự cố)'
  });

  return formatPublicClaim(created);
};

/**
 * Lấy danh sách Claim + trạng thái cửa sổ khiếu nại 14 ngày cho Tracking Page
 */
const getOrderClaimsForTracking = async (order) => {
  const emptyResult = {
    claims: [],
    can_submit_claim: false,
    claim_window_days: DEFAULT_CLAIM_WINDOW_DAYS,
    delivered_at: null,
    claim_window_deadline: null,
    claim_window_expired: false
  };

  if (!order?.id) return emptyResult;

  const [rows, claimWindowDays, deliveredAt] = await Promise.all([
    prisma.compensation_claims.findMany({
      where: { order_id: BigInt(order.id) },
      orderBy: { id: 'desc' }
    }),
    getClaimWindowDays(),
    getOrderDeliveredAt(order)
  ]);

  const statusKey = normalizeStatusKey(order.status);
  const isCancelled = statusKey === 'CANCELLED';
  const isDelivered = !isCancelled && (
    DELIVERED_ORDER_STATUSES.map(normalizeStatusKey).includes(statusKey) ||
    Boolean(order.is_closed && statusKey !== 'DRAFT')
  );

  let deadline = null;
  let expired = false;
  if (isDelivered && deliveredAt) {
    deadline = new Date(deliveredAt.getTime() + claimWindowDays * 86400000);
    expired = Date.now() > deadline.getTime();
  }

  return {
    claims: (rows || []).map(formatPublicClaim),
    can_submit_claim: Boolean(isDelivered && !expired),
    claim_window_days: claimWindowDays,
    delivered_at: deliveredAt ? deliveredAt.toISOString() : null,
    claim_window_deadline: deadline ? deadline.toISOString() : null,
    claim_window_expired: Boolean(isDelivered && expired)
  };
};

/**
 * Guest gửi yêu cầu bồi thường từ Tracking Page (UC-47, BR-59: <= 14 ngày)
 */
const createGuestClaimByToken = async (token, payload = {}) => {
  const whereFilter = buildOrderTokenWhere(token);
  if (!whereFilter) {
    throw createHttpError('Thiếu mã tra cứu đơn hàng.', 400);
  }

  const order = await prisma.orders.findFirst({
    where: whereFilter,
    select: {
      id: true,
      order_code: true,
      status: true,
      is_closed: true,
      receiver_name: true,
      receiver_phone: true,
      created_at: true,
      updated_at: true
    }
  });

  if (!order) {
    throw createHttpError('Không tìm thấy đơn hàng tương ứng với mã tra cứu này.', 404);
  }

  const statusKey = normalizeStatusKey(order.status);
  if (statusKey === 'CANCELLED') {
    throw createHttpError('Đơn hàng đã hủy, không thể gửi yêu cầu bồi thường.', 400);
  }

  const isDelivered =
    DELIVERED_ORDER_STATUSES.map(normalizeStatusKey).includes(statusKey) ||
    Boolean(order.is_closed && statusKey !== 'DRAFT');

  if (!isDelivered) {
    throw createHttpError('Chỉ có thể gửi yêu cầu bồi thường sau khi đơn hàng đã hoàn tất giao hàng (Delivered).', 400);
  }

  const [claimWindowDays, deliveredAt] = await Promise.all([
    getClaimWindowDays(),
    getOrderDeliveredAt(order)
  ]);

  if (deliveredAt) {
    const deadlineMs = deliveredAt.getTime() + claimWindowDays * 86400000;
    if (Date.now() > deadlineMs) {
      throw createHttpError(
        `Đã quá thời hạn ${claimWindowDays} ngày kể từ khi giao hàng để gửi yêu cầu bồi thường (BR-59).`,
        400
      );
    }
  }

  const reason = String(payload.reason || payload.description || '').trim();
  if (!reason) {
    throw createHttpError('Vui lòng nhập mô tả chi tiết thiệt hại / lý do khiếu nại.', 400);
  }

  const amountNum = payload.amount !== undefined && payload.amount !== null && payload.amount !== ''
    ? Number(payload.amount)
    : 0;
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    throw createHttpError('Số tiền yêu cầu bồi thường không hợp lệ (>= 0).', 400);
  }

  const claimType = normalizeClaimType(payload.claim_type);
  const uploadedUrls = await uploadEvidencePhotos(payload.evidence_photos || payload.photos);
  const submittedByName = payload.submitted_by_name
    ? String(payload.submitted_by_name).trim().slice(0, 150)
    : (order.receiver_name || null);
  const submittedByPhone = payload.submitted_by_phone
    ? String(payload.submitted_by_phone).trim().slice(0, 30)
    : (order.receiver_phone || null);

  const now = new Date();
  const created = await prisma.compensation_claims.create({
    data: {
      order_id: order.id,
      incident_id: null,
      source: 'CUSTOMER_CLAIM',
      claim_type: claimType,
      amount: BigInt(Math.round(amountNum)),
      reason,
      evidence_photos: uploadedUrls,
      evidence: uploadedUrls[0] || null,
      status: 'PENDING',
      created_by: null,
      submitted_by_name: submittedByName,
      submitted_by_phone: submittedByPhone,
      updated_at: now
    }
  });

  const claimIdNum = toNum(created.id);
  const claimCode = `CLM-${String(claimIdNum).padStart(4, '0')}`;

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: null,
        actor_type: 'GUEST',
        action: 'GUEST_SUBMIT_CLAIM',
        target_type: 'COMPENSATION_CLAIM',
        target_id: created.id,
        changes: {
          claim_code: claimCode,
          order_id: toNum(order.id),
          order_code: order.order_code,
          claim_type: claimType,
          amount: Math.round(amountNum),
          status: 'PENDING'
        },
        reason: reason.slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] createGuestClaimByToken activity_logs warning:', logErr.message);
  }

  await notifyManagers({
    claimId: claimIdNum,
    claimCode,
    orderCode: order.order_code,
    sourceLabel: 'Khách hàng (Tracking Page)'
  });

  return formatPublicClaim(created);
};


const getAllClaimsForPortal = async () => {
  const [rawClaims, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findMany({
      orderBy: { id: 'desc' },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  const claims = (rawClaims || []).map((c) => formatDetailedClaim(c, activeContractMap));

  const summary = {
    total: claims.length,
    pending: claims.filter((x) => x.status === 'PENDING').length,
    approved: claims.filter((x) => x.status === 'APPROVED').length,
    rejected: claims.filter((x) => x.status === 'REJECTED').length,
    paid: claims.filter((x) => x.status === 'PAID').length,
    closed_compensated: claims.filter((x) => x.status === 'CLOSED_COMPENSATED').length,
    closed_rejected: claims.filter((x) => x.status === 'CLOSED_REJECTED').length,
    awaiting_call: claims.filter((x) => (x.status === 'APPROVED' || x.status === 'REJECTED') && !x.called_at).length,
    awaiting_payment: claims.filter((x) => x.status === 'APPROVED' && Boolean(x.called_at)).length
  };

  return { claims, summary };
};


const getClaimById = async (id) => {
  const numId = parseClaimIdParam(id);
  const [row, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!row) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  return formatDetailedClaim(row, activeContractMap);
};

/**
 * Manager thẩm định & ra quyết định Approve / Reject Claim (BF-04)
 * Lưu trạng thái APPROVED hoặc REJECTED (KHÔNG đóng ngay - chờ Dispatcher gọi khách)
 */

module.exports = {
  createDispatcherClaim,
  getOrderClaimsForTracking,
  createGuestClaimByToken,
  getAllClaimsForPortal,
  getClaimById
};
