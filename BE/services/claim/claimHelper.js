const prisma = require('../../config/prisma');
const cloudinaryService = require('../cloudinaryService');
const { parseOrderMeta } = require('../orderHelperService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../../utils/prismaHelper');

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
          trip_trucks: { select: { released_time: true, trucks: { select: { plate_number: true } } } },
          trip_drivers: {
            select: {
              released_time: true,
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
    firstCargo?.declared_value !== null && firstCargo?.declared_value !== undefined
      ? Number(firstCargo.declared_value)
      : null;
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
  const activeTripTruck = (tripObj?.trip_trucks || []).find((tt) => !tt.released_time && tt.trucks) || tripObj?.trip_trucks?.[0];
  const activeTripDriver = (tripObj?.trip_drivers || []).find((td) => !td.released_time && td.driver_profiles?.users) || tripObj?.trip_drivers?.[0];
  const truckPlate = activeTripTruck?.trucks?.plate_number || null;
  const driverUser = activeTripDriver?.driver_profiles?.users || null;
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

module.exports = {
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
};
