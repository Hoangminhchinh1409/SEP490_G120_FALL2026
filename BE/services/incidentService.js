const prisma = require('../config/prisma');
const incidentModel = require('../models/incidentModel');
const claimService = require('./claimService');

const COMPENSATION_ELIGIBLE_NORMALIZED_TYPES = [
  'DAMAGED_LOST_CARGO',
  'DAMAGED_CARGO',
  'CARGO_DAMAGED',
  'CARGO_LOST',
  'ACCIDENT',
  'TRAFFIC_ACCIDENT',
  'CARGO_HELD',
  'HELD_BY_AUTHORITIES',
  'SEIZED_BY_AUTHORITY'
];

const isCompensationEligibleType = (type) => {
  const normalized = String(type || '').trim().toUpperCase().replace(/\s+/g, '_');
  return COMPENSATION_ELIGIBLE_NORMALIZED_TYPES.includes(normalized);
};

const formatIncident = (inc) => {
  const typeDisplayMap = {
    BREAKDOWN: 'HỎNG XE GIỮA ĐƯỜNG',
    ACCIDENT: 'VA CHẠM GIAO THÔNG',
    CARGO_DAMAGED: 'HƯ HỎNG HÀNG HÓA',
    CARGO_LOST: 'THẤT LẠC NIÊM PHONG',
    HELD_BY_AUTHORITIES: 'KIỂM TRA HẢI QUAN / CSGT',
    ROAD_BAN: 'CẤM ĐƯỜNG / KẸT XE',
    FAILED_DELIVERY: 'GIAO HÀNG KHÔNG THÀNH CÔNG',
    OTHER: 'SỰ CỐ KHÁC'
  };

  // Lấy xe và tài xế đang hoạt động trên chuyến
  const activeTruckAssign =
    (inc.trip?.trip_trucks || []).find(tt => !tt.released_time && tt.truck) ||
    inc.trip?.trip_trucks?.[0] ||
    {};
  const truckObj = activeTruckAssign.truck || inc.trip?.truck || {};

  const activeDriverAssign =
    (inc.trip?.trip_drivers || []).find(td => !td.released_time && td.driver?.user) ||
    inc.trip?.trip_drivers?.[0] ||
    {};
  const driverObj = activeDriverAssign.driver?.user || inc.trip?.driver?.user || {};
  const reportedAt = inc.reported_time || inc.reported_at || inc.created_at;

  const upperStatus = (inc.status || '').toUpperCase();
  let feStatus = 'PENDING';
  if (upperStatus === 'RESOLVED' || upperStatus === 'CLOSED') {
    feStatus = 'RESOLVED';
  } else if (upperStatus === 'ESCALATED' || upperStatus === 'ESCALATED_TO_MANAGER') {
    feStatus = 'ESCALATED';
  }

  const upperType = String(inc.type || 'OTHER').toUpperCase().replace(/\s+/g, '_');

  return {
    id: `INC-${inc.id}`,
    raw_id: inc.id,
    trip_id: inc.trip_id,
    trip_code: inc.trip?.trip_code || (inc.trip_id ? `TRIP-${inc.trip_id}` : null),
    truck: truckObj.plate_number || null,
    driver: driverObj.full_name || null,
    phone: driverObj.phone || null,
    type: typeDisplayMap[upperType] || inc.type,
    raw_type: inc.type,
    can_escalate_to_manager: isCompensationEligibleType(inc.type),
    severity: upperType === 'ACCIDENT' || upperType === 'BREAKDOWN' || upperType === 'CARGO_DAMAGED' ? 'HIGH' : 'MEDIUM',
    status: feStatus,
    db_status: inc.status,
    reported_at: reportedAt ? new Date(reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
    location: inc.location || null,
    description: inc.description || null,
    resolution_note: inc.resolution_note || null,
    escalation_reason: inc.escalation_reason || null,
    cargo_affected: inc.cargo_affected !== undefined ? inc.cargo_affected : null,
    resolved_by: inc.resolved_by ?? null,
    escalated_by: inc.escalated_by ?? null,
    resolved_time: inc.resolved_time || null,
    escalated_time: inc.escalated_time || null,
    photos: Array.isArray(inc.photos) ? inc.photos : [],
    trip_orders: inc.trip_orders || [],
    claims: inc.claims || [],
    has_claim: Array.isArray(inc.claims) && inc.claims.length > 0
  };
};

const getAllIncidents = async () => {
  const incidents = await incidentModel.findAll();
  return (incidents || []).map(inc => formatIncident(inc));
};

const VALID_INCIDENT_TYPES = [
  'BREAKDOWN',
  'ACCIDENT',
  'TRAFFIC_ACCIDENT',
  'CARGO_DAMAGED',
  'DAMAGED_CARGO',
  'DAMAGED_LOST_CARGO',
  'CARGO_LOST',
  'CARGO_HELD',
  'HELD_BY_AUTHORITIES',
  'SEIZED_BY_AUTHORITY',
  'ROAD_BAN',
  'FAILED_DELIVERY',
  'OTHER'
];

const normalizeIncidentTypeForValidation = (rawType) => {
  const trimmed = String(rawType || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase().replace(/\s+/g, '_');
  if (!VALID_INCIDENT_TYPES.includes(normalized)) {
    const error = new Error(`Loại sự cố không hợp lệ: ${rawType}`);
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
};

const createIncident = async (payload = {}, userId = 1) => {
  if (!payload || !payload.trip_id) {
    const error = new Error('Thiếu thông tin chuyến xe (trip_id)');
    error.statusCode = 400;
    throw error;
  }

  let realTripId = null;
  if (typeof payload.trip_id === 'number') {
    realTripId = payload.trip_id;
  } else if (typeof payload.trip_id === 'string') {
    if (payload.trip_id.toUpperCase().startsWith('TRIP-')) {
      const foundId = await incidentModel.findTripIdByCode(payload.trip_id);
      if (!foundId) {
        const error = new Error(`Không tìm thấy chuyến xe với mã ${payload.trip_id}`);
        error.statusCode = 404;
        throw error;
      }
      realTripId = foundId;
    } else {
      const parsed = parseInt(payload.trip_id, 10);
      if (isNaN(parsed)) {
        const error = new Error('Mã chuyến xe không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      realTripId = parsed;
    }
  }

  if (!realTripId || realTripId <= 0) {
    const error = new Error('Chuyến xe không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  const tripExists = await prisma.trips.findUnique({
    where: { id: BigInt(realTripId) },
    select: { id: true }
  });
  if (!tripExists) {
    const error = new Error(`Không tìm thấy chuyến xe với mã ${payload.trip_id}`);
    error.statusCode = 404;
    throw error;
  }

  // Validate incident type
  if (payload.type) {
    const normalizedType = String(payload.type).toUpperCase().replace(/\s+/g, '_');
    if (!VALID_INCIDENT_TYPES.includes(normalizedType)) {
      const error = new Error(`Loại sự cố không hợp lệ: ${payload.type}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const incidentData = {
    trip_id: realTripId,
    reported_by: userId,
    type: payload.type || 'BREAKDOWN',
    status: 'Reported',
    description: payload.description || 'Sự cố phát sinh trên đường vận chuyển cần điều phối xử lý',
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    reported_time: new Date()
  };

  const created = await incidentModel.create(incidentData);
  return formatIncident(created);
};

const updateIncidentStatus = async (id, payload = {}, userId = 1) => {
  if (id === undefined || id === null) {
    const error = new Error('Mã sự cố không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  const cleanIdStr = String(id).replace(/^INC-/i, '').trim();
  const realId = parseInt(cleanIdStr, 10);
  if (isNaN(realId) || realId <= 0) {
    const error = new Error('Mã sự cố không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  // UTC-IN-032: Check payload non-empty and has action/status/resolution/type
  if (
    !payload ||
    Object.keys(payload).length === 0 ||
    (
      !payload.status &&
      !payload.action &&
      !payload.type &&
      payload.cargo_affected === undefined &&
      !payload.new_truck &&
      !payload.relief_truck_plate &&
      !payload.resolution_note &&
      !payload.escalation_reason
    )
  ) {
    const error = new Error('Thiếu thông tin xử lý sự cố');
    error.statusCode = 400;
    throw error;
  }

  const nextType = payload.type !== undefined ? normalizeIncidentTypeForValidation(payload.type) : undefined;
  const rawAction = String(payload.status || payload.action || '').toUpperCase();

  // 1. Điều xe & tài xế thay thế + Cấp lại Vận đơn phiên bản mới (UC-15, BR-09, UC-41)
  if (
    rawAction === 'RESOLVED_REPLACED' ||
    rawAction === 'REPLACE' ||
    Boolean(payload.new_truck || payload.relief_truck_plate || payload.replacement_reason)
  ) {
    const newTruck = String(payload.new_truck || payload.relief_truck_plate || '').trim();
    if (!newTruck) {
      const error = new Error('Thiếu thông tin biển số xe thay thế');
      error.statusCode = 400;
      throw error;
    }

    const replaced = await incidentModel.dispatchReplacementWithTransaction({
      incidentId: realId,
      newTruckPlate: newTruck,
      newDriverName: payload.new_driver || payload.relief_driver_name,
      replacementReason: payload.replacement_reason || payload.resolution_note || 'Điều xe cứu hộ chuyển tải giữa đường',
      incidentType: nextType,
      userId
    });
    return {
      ...formatIncident(replaced),
      new_waybill_version: replaced.new_waybill_version,
      new_waybill_number: replaced.new_waybill_number,
      new_truck: replaced.new_truck_plate,
      new_driver: replaced.new_driver_name
    };
  }

  // 2. Chuyển tiếp sự cố nghiêm trọng lên Quản lý (UC-16) — chỉ áp dụng cho sự cố có thể phát sinh bồi thường
  if (rawAction === 'ESCALATED' || rawAction === 'ESCALATED_TO_MANAGER' || rawAction === 'ESCALATE') {
    const existingIncident = await incidentModel.findById(realId);
    if (!existingIncident) {
      const error = new Error('Không tìm thấy sự cố.');
      error.statusCode = 404;
      throw error;
    }

    const existingStatusUpper = String(existingIncident.db_status || existingIncident.status || '').toUpperCase();
    if (['RESOLVED', 'DONE', 'CLOSED', 'PAID', 'APPROVED', 'REJECTED'].includes(existingStatusUpper)) {
      const error = new Error('Sự cố này đã có kết quả xử lý, không thể chuyển tiếp lại lên Quản lý.');
      error.statusCode = 400;
      throw error;
    }

    const effectiveType = nextType || existingIncident.raw_type || existingIncident.type;
    if (!isCompensationEligibleType(effectiveType)) {
      const error = new Error('Sự cố này không phát sinh duyệt bồi thường hàng hóa (thuộc thẩm quyền Điều phối viên xử lý tại chỗ hoặc điều xe thay thế), không thể chuyển lên Quản lý.');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    const escReason = payload.escalation_reason || payload.resolution_note || 'Sự cố mức độ nghiêm trọng vượt thẩm quyền Điều phối viên, chuyển Quản lý phê duyệt phương án xử lý.';
    const cargoAffected = typeof payload.cargo_affected === 'boolean' ? payload.cargo_affected : undefined;
    const updated = await incidentModel.update(realId, {
      status: 'Escalated',
      ...(nextType ? { type: nextType } : {}),
      ...(cargoAffected !== undefined ? { cargo_affected: cargoAffected } : {}),
      escalated_by: userId || null,
      escalated_time: now,
      escalation_reason: escReason
    });

    try {
      const managers = await prisma.users.findMany({
        where: { role_id: 2n, status: { in: ['ACTIVE', 'Active'] } },
        select: { id: true }
      });
      if (managers && managers.length > 0) {
        const incCode = `INC-${String(realId).padStart(3, '0')}`;
        await prisma.notifications.createMany({
          data: managers.map((m) => ({
            user_account_id: m.id,
            target_type: 'INCIDENT',
            target_id: BigInt(realId),
            message: `[${incCode}] Điều phối viên đã chuyển tiếp sự cố nghiêm trọng lên Quản lý: ${escReason}`,
            created_time: now
          }))
        });
      }
      await prisma.activity_logs.create({
        data: {
          actor_id: userId ? BigInt(userId) : null,
          actor_type: 'DISPATCHER',
          action: 'ESCALATE_INCIDENT',
          target_type: 'INCIDENT',
          target_id: BigInt(realId),
          changes: {
            status: 'Escalated',
            escalation_reason: escReason,
            ...(cargoAffected !== undefined ? { cargo_affected: cargoAffected } : {}),
            ...(nextType ? { type: nextType } : {})
          },
          reason: escReason.slice(0, 255),
          created_time: now
        }
      });
    } catch (notifyErr) {
      console.warn('[incidentService] escalate notify/log warning:', notifyErr.message);
    }

    let createdClaim = null;
    if (payload.create_claim === true && cargoAffected !== false) {
      const hasExistingClaim = Array.isArray(updated.claims) && updated.claims.length > 0;
      if (!hasExistingClaim) {
        const orderIdToUse = payload.order_id || updated.trip_orders?.[0]?.id;
        if (orderIdToUse) {
          createdClaim = await claimService.createDispatcherClaim({
            incident_id: realId,
            order_id: orderIdToUse,
            claim_type: payload.claim_type || 'Damage',
            amount: payload.claim_amount ?? payload.amount ?? 0,
            reason: payload.claim_reason || escReason,
            evidence_photos: payload.evidence_photos || existingIncident.photos || []
          }, userId);
        }
      }
    }

    const formatted = formatIncident(updated);
    if (createdClaim) {
      const existingClaims = Array.isArray(formatted.claims) ? formatted.claims : [];
      const hasIt = existingClaims.some((c) => Number(c.id) === Number(createdClaim.id));
      return {
        ...formatted,
        claims: hasIt ? existingClaims : [createdClaim, ...existingClaims],
        has_claim: true,
        created_claim: createdClaim
      };
    }
    return formatted;
  }

  // 3. Đánh dấu đã giải quyết tại chỗ (UC-14)
  if (rawAction === 'RESOLVED' || rawAction === 'RESOLVE' || payload.resolution_note) {
    const existingIncident = await incidentModel.findById(realId);
    if (!existingIncident) {
      const error = new Error('Không tìm thấy sự cố.');
      error.statusCode = 404;
      throw error;
    }
    const existingStatusUpper = String(existingIncident.db_status || existingIncident.status || '').toUpperCase();
    if (['RESOLVED', 'DONE', 'CLOSED', 'PAID', 'APPROVED', 'REJECTED'].includes(existingStatusUpper)) {
      const error = new Error('Sự cố này đã được giải quyết hoặc chốt kết quả trước đó.');
      error.statusCode = 400;
      throw error;
    }
    const updated = await incidentModel.update(realId, {
      status: 'RESOLVED',
      ...(nextType ? { type: nextType } : {}),
      resolved_by: userId || null,
      resolution_note: payload.resolution_note || 'Điều phối viên đã hướng dẫn xử lý xong tại hiện trường',
      resolved_time: new Date()
    });
    return formatIncident(updated);
  }

  // 4. Chỉ phân loại lại sự cố / cập nhật đánh giá hàng hóa
  if (nextType || payload.cargo_affected !== undefined) {
    const existingIncident = await incidentModel.findById(realId);
    if (!existingIncident) {
      const error = new Error('Không tìm thấy sự cố.');
      error.statusCode = 404;
      throw error;
    }
    const existingStatusUpper = String(existingIncident.db_status || existingIncident.status || '').toUpperCase();
    if (['RESOLVED', 'DONE', 'CLOSED', 'PAID', 'APPROVED', 'REJECTED'].includes(existingStatusUpper)) {
      const error = new Error('Sự cố đã có kết quả xử lý, không thể thay đổi phân loại.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await incidentModel.update(realId, {
      ...(nextType ? { type: nextType } : {}),
      ...(typeof payload.cargo_affected === 'boolean' ? { cargo_affected: payload.cargo_affected } : {})
    });
    return formatIncident(updated);
  }

  const error = new Error(`Hành động xử lý sự cố không hợp lệ: ${payload.status || payload.action}`);
  error.statusCode = 400;
  throw error;
};

module.exports = {
  formatIncident,
  getAllIncidents,
  createIncident,
  updateIncidentStatus
};
