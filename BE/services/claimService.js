const prisma = require('../config/prisma');
const cloudinaryService = require('./cloudinaryService');
const { parseOrderMeta } = require('./orderHelperService');
const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
} = require('./emailService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../utils/prismaHelper');

const DEFAULT_CLAIM_WINDOW_DAYS = 14;
const DEFAULT_LIABILITY_CAP = 500000000;
const VALID_CLAIM_TYPES = {
  damage: 'Damage',
  shortage: 'Shortage',
  loss: 'Loss'
};

const DELIVERED_ORDER_STATUSES = [
  'DELIVERED',
  'DELIVERED_EXCEPTION',
  'DELIVERED (EXCEPTION)',
  'COMPLETED',
  'CLOSED'
];

const INCIDENT_TYPE_DISPLAY_MAP = {
  'Vehicle Issue': 'Hỏng xe',
  'BREAKDOWN': 'Hỏng xe',
  'Traffic': 'Cấm đường / Ùn tắc',
  'ROAD_BAN': 'Cấm đường / Ùn tắc',
  'TRAFFIC_ACCIDENT': 'Tai nạn giao thông',
  'ACCIDENT': 'Tai nạn giao thông',
  'DAMAGED_CARGO': 'Hàng hư hỏng / mất',
  'DAMAGED_LOST_CARGO': 'Hàng hư hỏng / mất',
  'CARGO_DAMAGED': 'Hàng hư hỏng / mất',
  'CARGO_LOST': 'Thất lạc hàng hóa',
  'CARGO_HELD': 'Hàng bị giữ',
  'SEIZED_BY_AUTHORITY': 'Cơ quan chức năng giữ xe',
  'HELD_BY_AUTHORITIES': 'Kiểm tra hải quan / CSGT',
  'FAILED_DELIVERY': 'Giao hàng không thành công',
  'OTHER': 'Sự cố khác'
};

const createHttpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const normalizeStatusKey = (status) =>
  String(status || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const normalizeClaimType = (rawType) => {
  if (rawType === undefined || rawType === null || String(rawType).trim() === '') {
    return 'Damage';
  }
  const key = String(rawType).trim().toLowerCase();
  if (!VALID_CLAIM_TYPES[key]) {
    throw createHttpError(`Loại khiếu nại không hợp lệ: ${rawType}. Chỉ chấp nhận Damage, Shortage hoặc Loss.`, 400);
  }
  return VALID_CLAIM_TYPES[key];
};

const parseJsonStringArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [val];
    } catch {
      return [val];
    }
  }
  return [];
};

const getClaimWindowDays = async () => {
  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'claim_window_days' },
      select: { value: true }
    });
    if (setting && setting.value !== null && setting.value !== undefined) {
      const rawVal = typeof setting.value === 'object'
        ? (setting.value.days ?? setting.value.value)
        : setting.value;
      const parsed = parseInt(String(rawVal), 10);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 90) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[claimService] getClaimWindowDays warning:', err.message);
  }
  return DEFAULT_CLAIM_WINDOW_DAYS;
};

const uploadEvidencePhotos = async (photos) => {
  if (!photos) return [];
  const list = Array.isArray(photos) ? photos : [photos];
  const cleaned = list
    .map((p) => (typeof p === 'string' ? p.trim() : p?.url || p?.thumbUrl || ''))
    .filter(Boolean);

  if (cleaned.length > 5) {
    throw createHttpError('Chỉ được đính kèm tối đa 5 ảnh minh chứng.', 400);
  }

  return Promise.all(
    cleaned.map((item) => cloudinaryService.uploadDataUriIfNeeded(item, 'nexlog/claims'))
  );
};

const notifyManagers = async ({ claimId, claimCode, orderCode, sourceLabel, customMessage = null }) => {
  try {
    const managers = await prisma.users.findMany({
      where: {
        role_id: 2n,
        status: { in: ['ACTIVE', 'Active'] }
      },
      select: { id: true }
    });

    if (!managers || managers.length === 0) return;

    const now = new Date();
    const message = customMessage || `[${claimCode}] Yêu cầu bồi thường mới từ ${sourceLabel} cho đơn hàng ${orderCode} đang chờ Quản lý thẩm định.`;
    await prisma.notifications.createMany({
      data: managers.map((m) => ({
        user_account_id: m.id,
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(claimId),
        message,
        created_time: now
      }))
    });
  } catch (err) {
    console.warn('[claimService] notifyManagers warning:', err.message);
  }
};

const notifyDispatchers = async ({ claimId, message }) => {
  try {
    const dispatchers = await prisma.users.findMany({
      where: {
        role_id: 3n,
        status: { in: ['ACTIVE', 'Active'] }
      },
      select: { id: true }
    });
    if (!dispatchers || dispatchers.length === 0) return;
    const now = new Date();
    await prisma.notifications.createMany({
      data: dispatchers.map((d) => ({
        user_account_id: d.id,
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(claimId),
        message,
        created_time: now
      }))
    });
  } catch (err) {
    console.warn('[claimService] notifyDispatchers warning:', err.message);
  }
};

const getOrderDeliveredAt = async (order) => {
  const orderBigId = toBigInt(order.id);
  if (!orderBigId) return null;

  try {
    const deliveredHist = await prisma.order_status_history.findFirst({
      where: {
        order_id: orderBigId,
        status: {
          in: ['Delivered', 'DELIVERED', 'Delivered (Exception)', 'DELIVERED_EXCEPTION', 'Completed', 'COMPLETED']
        }
      },
      orderBy: { changed_at: 'desc' },
      select: { changed_at: true }
    });
    if (deliveredHist?.changed_at) {
      return new Date(deliveredHist.changed_at);
    }

    const deliveredStop = await prisma.trip_stops.findFirst({
      where: {
        order_id: orderBigId,
        actual_arrival: { not: null },
        stop_type: { in: ['Drop-off', 'DROP_OFF', 'DROPOFF', 'Delivery', 'DELIVERY'] }
      },
      orderBy: { actual_arrival: 'desc' },
      select: { actual_arrival: true }
    });
    if (deliveredStop?.actual_arrival) {
      return new Date(deliveredStop.actual_arrival);
    }
  } catch (err) {
    console.warn('[claimService] getOrderDeliveredAt warning:', err.message);
  }

  const fallback = order.updated_at || order.created_at;
  return fallback ? new Date(fallback) : null;
};

const parseEvidencePhotos = (row) => {
  const arr = parseJsonStringArray(row?.evidence_photos);
  if (arr.length === 0 && row?.evidence) {
    arr.push(row.evidence);
  }
  return [...new Set(arr)];
};

const formatPublicClaim = (row) => {
  if (!row) return null;
  const s = serializePrisma(row);
  const idNum = toNum(row.id);
  return {
    id: idNum,
    claim_code: `CLM-${String(idNum).padStart(4, '0')}`,
    order_id: toNum(row.order_id),
    incident_id: toNum(row.incident_id),
    source: s.source || 'INCIDENT',
    claim_type: s.claim_type || 'Damage',
    amount: Number(s.amount || 0),
    approved_amount: Number(s.approved_amount || 0),
    reason: s.reason || '',
    evidence: s.evidence || null,
    evidence_photos: parseEvidencePhotos(s),
    status: String(s.status || 'PENDING').toUpperCase(),
    outcome: s.outcome || null,
    assessment_result: s.assessment_result || null,
    damage_percentage: s.damage_percentage !== null && s.damage_percentage !== undefined ? Number(s.damage_percentage) : null,
    contract_clause_ref: s.contract_clause_ref || null,
    rejection_reason: s.rejection_reason || null,
    contact_hotline: s.contact_hotline || '1900 1234',
    submitted_by_name: s.submitted_by_name || null,
    submitted_by_phone: s.submitted_by_phone || null,
    called_by: toNum(row.called_by),
    called_at: s.called_at || null,
    call_note: s.call_note || null,
    call_contact_phone: s.call_contact_phone || null,
    paid_by: toNum(row.paid_by),
    paid_at: s.paid_at || null,
    auto_close_deadline:
      String(s.status || '').toUpperCase() === 'PAID' && s.paid_at
        ? new Date(new Date(s.paid_at).getTime() + 7 * 86400000).toISOString()
        : null,
    payment_date: formatDateOnly(row.payment_date) || null,
    transaction_code: s.transaction_code || null,
    payment_proof_url: s.payment_proof_url || null,
    payment_note: s.payment_note || null,
    customer_confirmed_at: s.customer_confirmed_at || null,
    closed_at: s.closed_at || null,
    close_method: s.close_method || null,
    created_time: s.created_time || null,
    reviewed_time: s.reviewed_time || null,
    review_comment: s.review_comment || null
  };
};

const getClaimRelationsInclude = () => ({
  orders: {
    select: {
      id: true,
      order_code: true,
      order_type: true,
      status: true,
      agreed_price: true,
      customer_id: true,
      contract_id: true,
      tracking_token: true,
      receiver_name: true,
      receiver_phone: true,
      customers: {
        select: {
          id: true,
          company_name: true,
          contact_person: true,
          phone: true,
          email: true,
          tax_code: true
        }
      },
      transport_contracts: {
        select: {
          id: true,
          contract_number: true,
          liability_cap: true,
          compensation_terms: true,
          attachment_link: true,
          status: true
        }
      },
      order_cargos: {
        select: {
          cargo_name: true,
          quantity: true,
          unit: true,
          actual_weight_kg: true,
          declared_value: true
        }
      },
      order_notes: true,
      locations_orders_pickup_location_idTolocations: {
        select: { id: true, name: true, address: true }
      },
      locations_orders_delivery_location_idTolocations: {
        select: { id: true, name: true, address: true }
      },
      delivery_evidences: {
        select: {
          id: true,
          type: true,
          file_link: true,
          seal_number: true,
          receiver_name: true,
          captured_time: true
        },
        orderBy: { id: 'desc' }
      }
    }
  },
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
  users_compensation_claims_created_byTousers: {
    select: { id: true, full_name: true, phone: true }
  },
  users_compensation_claims_reviewed_byTousers: {
    select: { id: true, full_name: true }
  },
  users_compensation_claims_called_byTousers: {
    select: { id: true, full_name: true }
  },
  users_compensation_claims_paid_byTousers: {
    select: { id: true, full_name: true }
  }
});

const formatDetailedClaim = (row, activeContractMap = {}) => {
  if (!row) return null;
  const base = formatPublicClaim(row);
  const s = serializePrisma(row);
  const order = s.orders || null;
  const incident = s.incidents || null;
  const customer = order?.customers || null;

  let orderMeta = {};
  if (order) {
    try {
      orderMeta = parseOrderMeta(order);
    } catch {
      orderMeta = {};
    }
  }

  const cargosList = Array.isArray(order?.order_cargos)
    ? order.order_cargos
    : order?.order_cargos
      ? [order.order_cargos]
      : [];
  const firstCargo = cargosList[0] || null;
  const declaredValue =
    Number(firstCargo?.declared_value || 0) ||
    Number(order?.agreed_price || 0) * 10 ||
    0;
  const cargoDescription = firstCargo?.cargo_name
    ? `${firstCargo.cargo_name}${firstCargo.quantity ? ` - ${firstCargo.quantity} ${firstCargo.unit || 'kiện'}` : ''}${firstCargo.actual_weight_kg ? ` - ${firstCargo.actual_weight_kg} kg` : ''}`
    : 'Hàng hóa theo đơn vận chuyển';

  const pickupLoc = order?.locations_orders_pickup_location_idTolocations || null;
  const deliveryLoc = order?.locations_orders_delivery_location_idTolocations || null;
  const pAddr = orderMeta?.pickup_address || pickupLoc?.name || pickupLoc?.address;
  const dAddr = orderMeta?.delivery_address || deliveryLoc?.name || deliveryLoc?.address;
  const routeDisplay = pAddr && dAddr ? `${pAddr} → ${dAddr}` : null;

  const contractObj = order?.transport_contracts || (order?.customer_id ? activeContractMap[String(order.customer_id)] : null) || null;
  const contractCap = Number(contractObj?.liability_cap || 0);
  // BR-37: Trần hợp đồng nếu có hợp đồng; không có hợp đồng áp dụng trần 500 triệu VNĐ
  const liabilityLimit = contractCap > 0 ? contractCap : DEFAULT_LIABILITY_CAP;
  const requestedOrApproved = Math.max(Number(base.amount || 0), Number(base.approved_amount || 0));
  const isExceedingCap = requestedOrApproved > liabilityLimit;

  const pickupPhotos = [];
  const sealPhotos = [];
  const deliveryPhotos = [];
  (order?.delivery_evidences || []).forEach((ev) => {
    if (!ev?.file_link) return;
    const t = String(ev.type || '').toUpperCase();
    if (t === 'SEAL') sealPhotos.push(ev.file_link);
    else if (t === 'PICKUP' || t === 'CHECKIN') pickupPhotos.push(ev.file_link);
    else if (t === 'DELIVERY' || t === 'DAMAGE' || t === 'POD') deliveryPhotos.push(ev.file_link);
  });

  const tripObj = incident?.trips || null;
  const truckPlate = tripObj?.trip_trucks?.[0]?.trucks?.plate_number || null;
  const driverUser = tripObj?.trip_drivers?.[0]?.driver_profiles?.users || null;
  const incidentCode = incident?.id ? `INC-${String(incident.id).padStart(3, '0')}` : null;
  const incidentPhotos = parseJsonStringArray(incident?.photos);

  let sourceDisplay = 'Sự cố vận chuyển';
  if (base.source === 'CUSTOMER_CLAIM') {
    sourceDisplay = 'Khách hàng khiếu nại (Tracking Page)';
  } else if (base.source === 'DISPATCHER_ESCALATED') {
    sourceDisplay = 'ĐPV chuyển tiếp sự cố nghiêm trọng';
  } else if (base.source === 'DRIVER_REPORTED') {
    sourceDisplay = 'Tài xế báo cáo sự cố hiện trường';
  } else if (incidentCode) {
    sourceDisplay = `ĐPV tạo từ sự cố ${incidentCode}`;
  }

  const contactPhone =
    base.submitted_by_phone ||
    customer?.phone ||
    order?.receiver_phone ||
    null;
  const customerEmail =
    customer?.email ||
    orderMeta?.customer_email ||
    orderMeta?.contract_details?.customer_email ||
    null;

  return {
    ...base,
    customer: customer ? {
      id: toNum(customer.id),
      company_name: customer.company_name,
      contact_person: customer.contact_person || order?.receiver_name || null,
      phone: customer.phone || order?.receiver_phone || null,
      email: customerEmail,
      tax_code: customer.tax_code || null
    } : {
      id: null,
      company_name: base.submitted_by_name || order?.receiver_name || 'Khách hàng vãng lai',
      contact_person: base.submitted_by_name || order?.receiver_name || null,
      phone: contactPhone,
      email: customerEmail,
      tax_code: null
    },
    contract: contractObj ? {
      id: toNum(contractObj.id),
      contract_number: contractObj.contract_number,
      liability_cap: Number(contractObj.liability_cap || 0),
      compensation_terms: contractObj.compensation_terms || null,
      attachment_link: contractObj.attachment_link || null
    } : null,
    order_code: order?.order_code || 'N/A',
    order_type: order?.order_type || 'Export',
    order_status: order?.status || null,
    agreed_price: Number(order?.agreed_price || 0),
    declared_value: declaredValue,
    cargo_description: cargoDescription,
    route_display: routeDisplay,
    customer_id: toNum(order?.customer_id),
    receiver_name: order?.receiver_name || null,
    receiver_phone: order?.receiver_phone || null,
    contact_phone: contactPhone,
    customer_email: customerEmail,
    tracking_token: order?.tracking_token ? order.tracking_token.trim() : null,
    incident_code: incidentCode,
    incident_type: incident?.type || null,
    incident_type_display: incident?.type ? (INCIDENT_TYPE_DISPLAY_MAP[incident.type] || incident.type) : (base.source === 'CUSTOMER_CLAIM' ? 'Khiếu nại sau giao hàng' : 'Sự cố vận tải'),
    incident_fault: incident?.fault || null,
    incident_description: incident?.description || '',
    incident_status: incident?.status || null,
    incident_photos: incidentPhotos,
    incident_reported_time: incident?.reported_time || null,
    pickup_photos: pickupPhotos,
    seal_photos: sealPhotos,
    delivery_photos: deliveryPhotos,
    trip_id: toNum(incident?.trip_id || tripObj?.id),
    trip_code: tripObj?.trip_code || (incident?.trip_id ? `TRIP-${incident.trip_id}` : null),
    truck_plate: truckPlate,
    driver_name: driverUser?.full_name || null,
    driver_phone: driverUser?.phone || null,
    source_display: sourceDisplay,
    contract_cap: contractCap,
    liability_limit: liabilityLimit,
    is_exceeding_cap: isExceedingCap,
    created_by_name: s.users_compensation_claims_created_byTousers?.full_name || base.submitted_by_name || 'Khách hàng (Guest)',
    reviewed_by_name: s.users_compensation_claims_reviewed_byTousers?.full_name || null,
    called_by_name: s.users_compensation_claims_called_byTousers?.full_name || null,
    paid_by_name: s.users_compensation_claims_paid_byTousers?.full_name || null,
    decided_by: toNum(row.reviewed_by),
    decided_at: base.reviewed_time,
    decision_comment: base.review_comment,
    created_at: base.created_time
  };
};

const buildOrderTokenWhere = (token) => {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  if (cleanToken.startsWith('NEX-') || cleanToken.startsWith('ORD-')) {
    return { order_code: cleanToken };
  }
  return {
    OR: [{ tracking_token: cleanToken }, { order_code: cleanToken }]
  };
};

/**
 * Dispatcher tạo Claim từ sự cố nghiêm trọng ảnh hưởng hàng khách (BF-04)
 */
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

const getActiveContractMap = async () => {
  const rawContracts = await prisma.transport_contracts.findMany({
    where: { status: { in: ['ACTIVE', 'Active'] } },
    select: {
      id: true,
      customer_id: true,
      contract_number: true,
      liability_cap: true,
      compensation_terms: true,
      attachment_link: true
    }
  });
  const map = {};
  (serializePrisma(rawContracts) || []).forEach((c) => {
    if (c.customer_id) {
      map[String(c.customer_id)] = c;
    }
  });
  return map;
};

/**
 * Lấy danh sách toàn bộ Claim cho Portal Quản lý / Điều phối viên (BF-04)
 */
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

const parseClaimIdParam = (id) => {
  const clean = String(id || '').replace(/^CLM-/i, '').trim();
  const num = parseInt(clean, 10);
  if (!Number.isFinite(num) || num <= 0) {
    throw createHttpError('Mã yêu cầu bồi thường không hợp lệ.', 400);
  }
  return num;
};

/**
 * Lấy chi tiết 1 Claim kèm toàn bộ dữ liệu thẩm định 6 nguồn (BF-04)
 */
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
const decideClaim = async (id, payload = {}, managerId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'PENDING') {
    throw createHttpError(`Yêu cầu bồi thường đang ở trạng thái ${currentStatus}, không thể xét duyệt lại.`, 400);
  }

  const rawAction = String(payload.action || '').trim().toUpperCase();
  if (rawAction !== 'APPROVE' && rawAction !== 'REJECT') {
    throw createHttpError('Hành động xét duyệt không hợp lệ (chỉ nhận APPROVE hoặc REJECT).', 400);
  }

  const isApprove = rawAction === 'APPROVE';
  const detailedBefore = formatDetailedClaim(rawClaim, activeContractMap);
  const liabilityLimit = detailedBefore.liability_limit || DEFAULT_LIABILITY_CAP;
  const now = new Date();
  const reviewerBigId = managerId ? BigInt(managerId) : null;
  const assessmentResult = payload.assessment_result ? String(payload.assessment_result).trim() : null;
  const contactHotline = payload.contact_hotline ? String(payload.contact_hotline).trim().slice(0, 20) : '1900 1234';

  let updateData;
  let emailResult = { sent: false, customer_email: detailedBefore.customer_email || null, email_type: null, error: null };

  if (isApprove) {
    const approvedAmount =
      payload.approved_amount !== undefined && payload.approved_amount !== null && payload.approved_amount !== ''
        ? Number(payload.approved_amount)
        : Number(rawClaim.amount || 0);

    if (!Number.isFinite(approvedAmount) || approvedAmount < 0) {
      throw createHttpError('Số tiền phê duyệt bồi thường không hợp lệ (>= 0).', 400);
    }

    const commentStr = String(payload.comment || payload.resolution_note || payload.note || '').trim();
    if (approvedAmount > liabilityLimit && !commentStr) {
      throw createHttpError(
        `Số tiền duyệt (${approvedAmount.toLocaleString('vi-VN')} đ) vượt hạn mức trách nhiệm (${liabilityLimit.toLocaleString('vi-VN')} đ). Bắt buộc nhập nhận xét/lý do phê duyệt ngoại lệ (MSG56).`,
        400
      );
    }

    const damagePct =
      payload.damage_percentage !== undefined && payload.damage_percentage !== null && payload.damage_percentage !== ''
        ? Number(payload.damage_percentage)
        : null;
    const outcome = payload.outcome || payload.goods_handling_method || 'CUSTOMER_RETAIN';
    const clauseRef = payload.contract_clause_ref
      ? String(payload.contract_clause_ref).trim()
      : 'Điều 8.2 - Bồi thường thiệt hại hàng hóa';

    updateData = {
      status: 'APPROVED',
      approved_amount: BigInt(Math.round(approvedAmount)),
      outcome,
      damage_percentage: damagePct,
      assessment_result: assessmentResult,
      contract_clause_ref: clauseRef,
      contact_hotline: contactHotline,
      reviewed_by: reviewerBigId,
      reviewed_time: now,
      review_comment: commentStr || `Phê duyệt bồi thường ${Math.round(approvedAmount).toLocaleString('vi-VN')} đ theo ${clauseRef}.`,
      updated_at: now
    };
  } else {
    const rejectionReason = String(payload.rejection_reason || payload.comment || payload.note || '').trim();
    if (!rejectionReason) {
      throw createHttpError('Bắt buộc nhập lý do chi tiết khi từ chối bồi thường.', 400);
    }
    const clauseRef = payload.contract_clause_ref
      ? String(payload.contract_clause_ref).trim()
      : 'Điều 4.2 - Miễn trừ trách nhiệm theo Hợp đồng';

    updateData = {
      status: 'REJECTED',
      approved_amount: 0n,
      rejection_reason: rejectionReason,
      assessment_result: assessmentResult,
      contract_clause_ref: clauseRef,
      contact_hotline: contactHotline,
      reviewed_by: reviewerBigId,
      reviewed_time: now,
      review_comment: String(payload.comment || rejectionReason).trim(),
      updated_at: now
    };
  }

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: updateData,
    include: getClaimRelationsInclude()
  });

  if (rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        status: isApprove ? 'APPROVED' : 'REJECTED',
        approved_compensation_amount: updateData.approved_amount,
        rejection_reason: isApprove ? null : updateData.rejection_reason,
        contract_clause_ref: updateData.contract_clause_ref,
        updated_at: now
      },
      select: { id: true }
    }).catch((incErr) => {
      console.warn('[claimService] decideClaim sync incident warning:', incErr.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  // Gửi Email thông báo quyết định cho khách hàng (không chặn transaction nếu SMTP lỗi)
  if (detailedAfter.customer_email) {
    try {
      const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
      const trackingToken = (detailedAfter.tracking_token || detailedAfter.order_code || '').trim();
      const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

      let sendRes;
      if (isApprove) {
        sendRes = await sendIncidentCompensationApprovalEmail({
          customerEmail: detailedAfter.customer_email,
          customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
          contactPerson: detailedAfter.customer?.contact_person || '',
          orderCode: detailedAfter.order_code,
          tripCode: detailedAfter.trip_code || 'N/A',
          incidentCode: detailedAfter.incident_code || detailedAfter.claim_code,
          claimCode: detailedAfter.claim_code,
          incidentType: detailedAfter.incident_type_display,
          cargoDescription: detailedAfter.cargo_description,
          declaredValue: detailedAfter.declared_value || 0,
          damagePercentage: detailedAfter.damage_percentage || 0,
          approvedAmount: detailedAfter.approved_amount || 0,
          goodsHandlingMethod: detailedAfter.outcome || 'CUSTOMER_RETAIN',
          contractClauseRef: detailedAfter.contract_clause_ref,
          resolutionNote: detailedAfter.review_comment,
          surveyOrgReport: detailedAfter.assessment_result || '',
          contactHotline: detailedAfter.contact_hotline || '1900 1234',
          trackingUrl
        });
      } else {
        sendRes = await sendIncidentCompensationRejectionEmail({
          customerEmail: detailedAfter.customer_email,
          customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
          contactPerson: detailedAfter.customer?.contact_person || '',
          orderCode: detailedAfter.order_code,
          tripCode: detailedAfter.trip_code || 'N/A',
          incidentCode: detailedAfter.incident_code || detailedAfter.claim_code,
          claimCode: detailedAfter.claim_code,
          incidentType: detailedAfter.incident_type_display,
          cargoDescription: detailedAfter.cargo_description,
          rejectionReason: detailedAfter.rejection_reason,
          rejectionClause: detailedAfter.contract_clause_ref,
          resolutionNote: detailedAfter.review_comment,
          contactHotline: detailedAfter.contact_hotline || '1900 1234',
          trackingUrl
        });
      }

      emailResult = {
        sent: Boolean(sendRes?.success),
        customer_email: detailedAfter.customer_email,
        email_type: isApprove ? 'APPROVAL' : 'REJECTION',
        preview_url: sendRes?.previewUrl || null,
        error: sendRes?.success ? null : (sendRes?.error || null)
      };
    } catch (mailErr) {
      console.warn('[claimService] decideClaim email warning:', mailErr.message);
      emailResult.error = mailErr.message;
    }
  }

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: reviewerBigId,
        actor_type: 'MANAGER',
        action: isApprove ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: updateData.status,
          approved_amount: Number(updateData.approved_amount || 0),
          outcome: updateData.outcome || null,
          contract_clause_ref: updateData.contract_clause_ref,
          email_sent: emailResult.sent
        },
        reason: String(updateData.review_comment || '').slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] decideClaim activity_logs warning:', logErr.message);
  }

  // Nhắc Điều phối viên gọi điện thông báo khách hàng & ghi nhận cuộc gọi (BF-04)
  await notifyDispatchers({
    claimId: numId,
    message: isApprove
      ? `[${detailedAfter.claim_code}] Quản lý đã PHÊ DUYỆT bồi thường ${detailedAfter.approved_amount.toLocaleString('vi-VN')} đ cho đơn ${detailedAfter.order_code}. Vui lòng gọi điện khách hàng (${detailedAfter.contact_phone || 'chưa có SĐT'}) và ghi nhận cuộc gọi để mở khóa thanh toán.`
      : `[${detailedAfter.claim_code}] Quản lý đã TỪ CHỐI bồi thường cho đơn ${detailedAfter.order_code}. Vui lòng gọi điện thông báo lý do cho khách hàng (${detailedAfter.contact_phone || 'chưa có SĐT'}) và ghi nhận cuộc gọi để đóng hồ sơ.`
  });

  return { claim: detailedAfter, email_result: emailResult };
};

/**
 * Dispatcher gọi điện thông báo khách hàng & ghi nhận cuộc gọi (BF-04)
 * - Nếu REJECTED -> tự động đóng sang CLOSED_REJECTED (close_method = REJECTED_AFTER_CALL)
 * - Nếu APPROVED -> giữ APPROVED với called_at != null để mở khóa bước Manager Record Payment
 */
const recordDispatcherCall = async (id, payload = {}, dispatcherId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'APPROVED' && currentStatus !== 'REJECTED') {
    throw createHttpError(
      `Chỉ có thể ghi nhận cuộc gọi khi yêu cầu bồi thường đang ở trạng thái APPROVED hoặc REJECTED (hiện tại: ${currentStatus}).`,
      400
    );
  }

  if (rawClaim.called_at) {
    throw createHttpError('Cuộc gọi thông báo khách hàng cho yêu cầu này đã được ghi nhận trước đó.', 400);
  }

  const callNote = String(payload.call_note || payload.reason || payload.note || '').trim();
  if (!callNote) {
    throw createHttpError('Vui lòng nhập nội dung trao đổi / lý do ghi nhận cuộc gọi với khách hàng.', 400);
  }

  const contactPhone = String(
    payload.call_contact_phone ||
    payload.contact_phone ||
    rawClaim.submitted_by_phone ||
    rawClaim.orders?.customers?.phone ||
    rawClaim.orders?.receiver_phone ||
    ''
  ).trim().slice(0, 30) || null;

  const now = new Date();
  const actorBigId = toBigInt(dispatcherId || 1);
  const isRejected = currentStatus === 'REJECTED';

  const updateData = {
    called_by: actorBigId,
    called_at: now,
    call_note: callNote,
    call_contact_phone: contactPhone,
    updated_at: now,
    ...(isRejected ? {
      status: 'CLOSED_REJECTED',
      closed_at: now,
      close_method: 'REJECTED_AFTER_CALL'
    } : {})
  };

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: updateData,
    include: getClaimRelationsInclude()
  });

  if (isRejected && rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        status: 'CLOSED',
        closed_by: actorBigId,
        closed_at: now,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] recordDispatcherCall sync incident warning:', err.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
        actor_type: 'DISPATCHER',
        action: isRejected ? 'RECORD_CALL_CLOSE_REJECTED' : 'RECORD_CALL_UNLOCK_PAYMENT',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: detailedAfter.status,
          call_contact_phone: contactPhone,
          called_at: now.toISOString(),
          close_method: detailedAfter.close_method || null
        },
        reason: callNote.slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] recordDispatcherCall activity_logs warning:', logErr.message);
  }

  await notifyManagers({
    claimId: numId,
    claimCode: detailedAfter.claim_code,
    orderCode: detailedAfter.order_code,
    sourceLabel: 'Điều phối viên',
    customMessage: isRejected
      ? `[${detailedAfter.claim_code}] ĐPV đã gọi điện thông báo từ chối cho khách (${contactPhone || 'N/A'}) và đóng hồ sơ (CLOSED_REJECTED).`
      : `[${detailedAfter.claim_code}] ĐPV đã gọi điện thống nhất bồi thường với khách (${contactPhone || 'N/A'}). Quản lý có thể tiến hành ghi nhận thanh toán.`
  });

  return detailedAfter;
};

/**
 * Manager ghi nhận đã thanh toán tiền bồi thường & chứng từ chuyển khoản (BF-04)
 * Yêu cầu Claim đang APPROVED và Dispatcher đã ghi nhận cuộc gọi (called_at != null)
 */
const recordManagerPayment = async (id, payload = {}, managerId = 1) => {
  const numId = parseClaimIdParam(id);
  const [rawClaim, activeContractMap] = await Promise.all([
    prisma.compensation_claims.findUnique({
      where: { id: BigInt(numId) },
      include: getClaimRelationsInclude()
    }),
    getActiveContractMap()
  ]);

  if (!rawClaim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường.', 404);
  }

  const currentStatus = String(rawClaim.status || '').toUpperCase();
  if (currentStatus !== 'APPROVED') {
    throw createHttpError(
      `Chỉ có thể ghi nhận thanh toán khi yêu cầu bồi thường ở trạng thái APPROVED (hiện tại: ${currentStatus}).`,
      400
    );
  }

  if (!rawClaim.called_at) {
    throw createHttpError(
      'Điều phối viên chưa ghi nhận cuộc gọi thông báo khách hàng. Cần hoàn tất bước gọi khách trước khi ghi nhận thanh toán.',
      400
    );
  }

  const transactionCode = String(payload.transaction_code || '').trim();
  if (!transactionCode) {
    throw createHttpError('Vui lòng nhập mã giao dịch ngân hàng (UNC).', 400);
  }

  const rawProof = String(payload.payment_proof_url || '').trim();
  if (!rawProof) {
    throw createHttpError('Vui lòng tải lên ảnh biên lai / chứng từ chuyển khoản.', 400);
  }

  const uploadedProofUrl = await cloudinaryService.uploadDataUriIfNeeded(rawProof, 'nexlog/claims');
  const now = new Date();
  let parsedPaymentDate = now;
  if (payload.payment_date) {
    const candidate = new Date(
      String(payload.payment_date).includes('T')
        ? payload.payment_date
        : `${String(payload.payment_date).trim()}T00:00:00.000Z`
    );
    if (!Number.isNaN(candidate.getTime())) {
      parsedPaymentDate = candidate;
    }
  }
  const paymentNote = payload.payment_note ? String(payload.payment_note).trim() : null;
  const actorBigId = BigInt(managerId || 1);

  const updatedRow = await prisma.compensation_claims.update({
    where: { id: BigInt(numId) },
    data: {
      status: 'PAID',
      paid_by: actorBigId,
      paid_at: now,
      payment_date: parsedPaymentDate,
      transaction_code: transactionCode.slice(0, 100),
      payment_proof_url: uploadedProofUrl,
      evidence: uploadedProofUrl,
      payment_note: paymentNote,
      updated_at: now
    },
    include: getClaimRelationsInclude()
  });

  if (rawClaim.incident_id) {
    await prisma.incidents.update({
      where: { id: rawClaim.incident_id },
      data: {
        payment_proof_url: uploadedProofUrl,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] recordManagerPayment sync incident warning:', err.message);
    });
  }

  const detailedAfter = formatDetailedClaim(updatedRow, activeContractMap);

  let emailResult = { sent: false, customer_email: detailedAfter.customer_email || null, email_type: 'PAYMENT_RECORDED', error: null };
  if (detailedAfter.customer_email) {
    try {
      const clientOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
      const trackingToken = (detailedAfter.tracking_token || detailedAfter.order_code || '').trim();
      const trackingUrl = trackingToken ? `${clientOrigin}/t/${trackingToken}` : null;

      const sendRes = await sendClaimPaymentRecordedEmail({
        customerEmail: detailedAfter.customer_email,
        customerName: detailedAfter.customer?.company_name || 'Quý khách hàng',
        contactPerson: detailedAfter.customer?.contact_person || '',
        orderCode: detailedAfter.order_code,
        claimCode: detailedAfter.claim_code,
        approvedAmount: detailedAfter.approved_amount || detailedAfter.amount || 0,
        paymentDate: detailedAfter.payment_date || formatDateOnly(now),
        transactionCode: detailedAfter.transaction_code,
        paymentProofUrl: detailedAfter.payment_proof_url,
        paymentNote: detailedAfter.payment_note,
        contactHotline: detailedAfter.contact_hotline || '1900 1234',
        trackingUrl
      });

      emailResult = {
        sent: Boolean(sendRes?.success),
        customer_email: detailedAfter.customer_email,
        email_type: 'PAYMENT_RECORDED',
        preview_url: sendRes?.previewUrl || null,
        error: sendRes?.success ? null : (sendRes?.error || null)
      };
    } catch (mailErr) {
      console.warn('[claimService] recordManagerPayment email warning:', mailErr.message);
      emailResult.error = mailErr.message;
    }
  }

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: actorBigId,
        actor_type: 'MANAGER',
        action: 'RECORD_CLAIM_PAYMENT',
        target_type: 'COMPENSATION_CLAIM',
        target_id: BigInt(numId),
        changes: {
          status: 'PAID',
          transaction_code: detailedAfter.transaction_code,
          payment_date: detailedAfter.payment_date,
          payment_proof_url: uploadedProofUrl,
          email_sent: emailResult.sent
        },
        reason: (paymentNote || `Đã chi trả bồi thường, Mã GD: ${transactionCode}`).slice(0, 255),
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] recordManagerPayment activity_logs warning:', logErr.message);
  }

  await notifyDispatchers({
    claimId: numId,
    message: `[${detailedAfter.claim_code}] Quản lý đã ghi nhận chuyển khoản bồi thường (Mã GD: ${detailedAfter.transaction_code}) cho đơn ${detailedAfter.order_code}. Đang chờ khách hàng xác nhận nhận tiền (tự đóng sau 7 ngày).`
  });

  return { claim: detailedAfter, email_result: emailResult };
};

/**
 * Khách hàng xác nhận đã nhận tiền bồi thường trên Tracking Page (BF-04)
 * Chuyển trạng thái PAID -> CLOSED_COMPENSATED (close_method = CUSTOMER_CONFIRMED)
 */
const confirmCustomerMoneyReceived = async (token, payload = {}) => {
  const whereFilter = buildOrderTokenWhere(token);
  if (!whereFilter) {
    throw createHttpError('Thiếu mã tra cứu đơn hàng.', 400);
  }

  const order = await prisma.orders.findFirst({
    where: whereFilter,
    select: { id: true, order_code: true }
  });

  if (!order) {
    throw createHttpError('Không tìm thấy đơn hàng tương ứng với mã tra cứu này.', 404);
  }

  let claim = null;
  if (payload?.claim_id !== undefined && payload?.claim_id !== null && String(payload.claim_id).trim() !== '') {
    const claimIdNum = parseClaimIdParam(payload.claim_id);
    claim = await prisma.compensation_claims.findFirst({
      where: {
        id: BigInt(claimIdNum),
        order_id: order.id
      }
    });
  } else {
    claim = await prisma.compensation_claims.findFirst({
      where: {
        order_id: order.id,
        status: 'PAID'
      },
      orderBy: { id: 'desc' }
    });
  }

  if (!claim) {
    throw createHttpError('Không tìm thấy yêu cầu bồi thường phù hợp của đơn hàng này.', 404);
  }

  const statusUpper = String(claim.status || '').toUpperCase();
  if (statusUpper === 'CLOSED_COMPENSATED') {
    throw createHttpError('Yêu cầu bồi thường này đã được xác nhận nhận tiền và đóng hồ sơ trước đó.', 400);
  }
  if (statusUpper !== 'PAID') {
    throw createHttpError('Chỉ có thể xác nhận đã nhận tiền khi Quản lý đã ghi nhận thanh toán.', 400);
  }

  const now = new Date();
  const updatedRow = await prisma.compensation_claims.update({
    where: { id: claim.id },
    data: {
      status: 'CLOSED_COMPENSATED',
      customer_confirmed_at: now,
      closed_at: now,
      close_method: 'CUSTOMER_CONFIRMED',
      updated_at: now
    }
  });

  if (claim.incident_id) {
    await prisma.incidents.update({
      where: { id: claim.incident_id },
      data: {
        status: 'DONE',
        closed_at: now,
        updated_at: now
      },
      select: { id: true }
    }).catch((err) => {
      console.warn('[claimService] confirmCustomerMoneyReceived sync incident warning:', err.message);
    });
  }

  const publicClaim = formatPublicClaim(updatedRow);

  try {
    await prisma.activity_logs.create({
      data: {
        actor_id: null,
        actor_type: 'GUEST',
        action: 'GUEST_CONFIRM_MONEY_RECEIVED',
        target_type: 'COMPENSATION_CLAIM',
        target_id: claim.id,
        changes: {
          status: 'CLOSED_COMPENSATED',
          close_method: 'CUSTOMER_CONFIRMED',
          customer_confirmed_at: now.toISOString()
        },
        reason: `Khách hàng xác nhận đã nhận tiền bồi thường trên Tracking Page (${publicClaim.claim_code}).`,
        created_time: now
      }
    });
  } catch (logErr) {
    console.warn('[claimService] confirmCustomerMoneyReceived activity_logs warning:', logErr.message);
  }

  const notifyMsg = `[${publicClaim.claim_code}] Khách hàng đã XÁC NHẬN ĐÃ NHẬN TIỀN bồi thường cho đơn ${order.order_code}. Hồ sơ đã đóng (CLOSED_COMPENSATED).`;
  await Promise.all([
    notifyManagers({
      claimId: publicClaim.id,
      claimCode: publicClaim.claim_code,
      orderCode: order.order_code,
      sourceLabel: 'Khách hàng',
      customMessage: notifyMsg
    }),
    notifyDispatchers({
      claimId: publicClaim.id,
      message: notifyMsg
    })
  ]);

  return publicClaim;
};

/**
 * Tự động đóng các Claim đã chi trả (PAID) quá 7 ngày mà khách chưa xác nhận (BF-04)
 */
const autoCloseOverduePaidClaims = async ({ now = new Date(), autoCloseDays = 7 } = {}) => {
  const cutoff = new Date(now.getTime() - autoCloseDays * 86400000);
  const overdueClaims = await prisma.compensation_claims.findMany({
    where: {
      status: { in: ['PAID', 'Paid'] },
      customer_confirmed_at: null,
      paid_at: { lte: cutoff }
    },
    include: {
      orders: { select: { order_code: true } }
    }
  });

  if (!overdueClaims || overdueClaims.length === 0) {
    return { closedCount: 0, closedClaimIds: [] };
  }

  const closedClaimIds = [];

  for (const claim of overdueClaims) {
    const idNum = toNum(claim.id);
    const claimCode = `CLM-${String(idNum).padStart(4, '0')}`;
    const orderCode = claim.orders?.order_code || `ORDER-${toNum(claim.order_id)}`;

    await prisma.compensation_claims.update({
      where: { id: claim.id },
      data: {
        status: 'CLOSED_COMPENSATED',
        closed_at: now,
        close_method: 'AUTO_7_DAYS',
        updated_at: now
      }
    });

    if (claim.incident_id) {
      await prisma.incidents.update({
        where: { id: claim.incident_id },
        data: {
          status: 'DONE',
          closed_at: now,
          updated_at: now
        },
        select: { id: true }
      }).catch((err) => {
        console.warn('[claimService] autoCloseOverduePaidClaims sync incident warning:', err.message);
      });
    }

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: null,
          actor_type: 'SYSTEM',
          action: 'AUTO_CLOSE_CLAIM_7_DAYS',
          target_type: 'COMPENSATION_CLAIM',
          target_id: claim.id,
          changes: {
            status: 'CLOSED_COMPENSATED',
            close_method: 'AUTO_7_DAYS',
            paid_at: claim.paid_at ? new Date(claim.paid_at).toISOString() : null,
            closed_at: now.toISOString()
          },
          reason: `Tự động đóng hồ sơ bồi thường ${claimCode} sau ${autoCloseDays} ngày không có phản hồi từ khách hàng (BF-04).`,
          created_time: now
        }
      });
    } catch (logErr) {
      console.warn('[claimService] autoCloseOverduePaidClaims activity_logs warning:', logErr.message);
    }

    const msg = `[${claimCode}] Hệ thống đã tự động đóng hồ sơ bồi thường đơn ${orderCode} (CLOSED_COMPENSATED · AUTO_7_DAYS) sau ${autoCloseDays} ngày khách không phản hồi.`;
    await Promise.all([
      notifyManagers({
        claimId: idNum,
        claimCode,
        orderCode,
        sourceLabel: 'Hệ thống',
        customMessage: msg
      }),
      notifyDispatchers({
        claimId: idNum,
        message: msg
      })
    ]);

    closedClaimIds.push(idNum);
  }

  return { closedCount: closedClaimIds.length, closedClaimIds };
};

/**
 * Lấy danh sách order_id & trip_id đang có Claim chưa đóng để bảo lưu dữ liệu (Keep Trip Data - JOB-01)
 */
const getProtectedClaimOrderAndTripIds = async () => {
  const openClaims = await prisma.compensation_claims.findMany({
    where: {
      status: { notIn: ['CLOSED_COMPENSATED', 'CLOSED_REJECTED', 'CLOSED', 'Closed'] }
    },
    select: {
      order_id: true,
      incident_id: true,
      incidents: { select: { trip_id: true } }
    }
  });

  const orderIdSet = new Set();
  const tripIdSet = new Set();

  for (const c of openClaims || []) {
    const oId = toNum(c.order_id);
    if (oId) orderIdSet.add(oId);
    const tId = toNum(c.incidents?.trip_id);
    if (tId) tripIdSet.add(tId);
  }

  const protectedOrderIds = Array.from(orderIdSet);
  if (protectedOrderIds.length > 0) {
    const stops = await prisma.trip_stops.findMany({
      where: {
        order_id: { in: protectedOrderIds.map((id) => BigInt(id)) }
      },
      select: { trip_id: true }
    });
    for (const s of stops || []) {
      const tId = toNum(s.trip_id);
      if (tId) tripIdSet.add(tId);
    }
  }

  return {
    protectedOrderIds,
    protectedTripIds: Array.from(tripIdSet)
  };
};

module.exports = {
  createDispatcherClaim,
  getOrderClaimsForTracking,
  createGuestClaimByToken,
  getAllClaimsForPortal,
  getClaimById,
  decideClaim,
  recordDispatcherCall,
  recordManagerPayment,
  confirmCustomerMoneyReceived,
  autoCloseOverduePaidClaims,
  getProtectedClaimOrderAndTripIds,
  formatPublicClaim,
  formatDetailedClaim,
  getClaimWindowDays
};
