const incidentModel = require('../models/incidentModel');

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
    severity: upperType === 'ACCIDENT' || upperType === 'BREAKDOWN' || upperType === 'CARGO_DAMAGED' ? 'HIGH' : 'MEDIUM',
    status: feStatus,
    db_status: inc.status,
    reported_at: reportedAt ? new Date(reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
    location: inc.location || null,
    description: inc.description || null,
    resolution_note: inc.resolution_note || null,
    escalation_reason: inc.escalation_reason || null,
    resolved_time: inc.resolved_time || null,
    escalated_time: inc.escalated_time || null,
    photos: inc.photos || []
  };
};

const getAllIncidents = async () => {
  const incidents = await incidentModel.findAll();
  return (incidents || []).map(inc => formatIncident(inc));
};

const VALID_INCIDENT_TYPES = [
  'BREAKDOWN',
  'ACCIDENT',
  'CARGO_DAMAGED',
  'CARGO_LOST',
  'HELD_BY_AUTHORITIES',
  'ROAD_BAN',
  'FAILED_DELIVERY',
  'OTHER'
];

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

  if (!realTripId) {
    const error = new Error('Chuyến xe không hợp lệ');
    error.statusCode = 400;
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

  // UTC-IN-032: Check payload non-empty and has action/status/resolution
  if (!payload || Object.keys(payload).length === 0 || (!payload.status && !payload.action && !payload.new_truck && !payload.relief_truck_plate && !payload.resolution_note && !payload.escalation_reason)) {
    const error = new Error('Thiếu thông tin xử lý sự cố');
    error.statusCode = 400;
    throw error;
  }

  const rawAction = String(payload.status || payload.action || '').toUpperCase();

  // 1. Điều xe & tài xế thay thế + Cấp lại Vận đơn phiên bản mới (UC-15, BR-09, UC-41)
  if (
    rawAction === 'RESOLVED_REPLACED' ||
    rawAction === 'REPLACE' ||
    Boolean(payload.new_truck || payload.relief_truck_plate || payload.replacement_reason)
  ) {
    const newTruck = payload.new_truck || payload.relief_truck_plate;
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

  // 2. Chuyển tiếp sự cố nghiêm trọng lên Quản lý (UC-16)
  if (rawAction === 'ESCALATED' || rawAction === 'ESCALATED_TO_MANAGER' || rawAction === 'ESCALATE') {
    const updated = await incidentModel.update(realId, {
      status: 'Escalated',
      escalated_time: new Date(),
      escalation_reason: payload.escalation_reason || payload.resolution_note || 'Sự cố mức độ nghiêm trọng vượt thẩm quyền Điều phối viên, chuyển Quản lý phê duyệt phương án xử lý.'
    });
    return formatIncident(updated);
  }

  // 3. Đánh dấu đã giải quyết tại chỗ (UC-14)
  if (rawAction === 'RESOLVED' || rawAction === 'RESOLVE' || payload.resolution_note) {
    const updated = await incidentModel.update(realId, {
      status: 'RESOLVED',
      resolution_note: payload.resolution_note || 'Điều phối viên đã hướng dẫn xử lý xong tại hiện trường',
      resolved_time: new Date()
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
