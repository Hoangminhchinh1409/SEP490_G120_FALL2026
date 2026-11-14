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
    trip_code: inc.trip?.trip_code || `TRIP-${inc.trip_id}`,
    truck: truckObj.plate_number || '29H-995.72',
    driver: driverObj.full_name || 'Tài xế',
    phone: driverObj.phone || '0901234567',
    type: typeDisplayMap[upperType] || inc.type,
    raw_type: inc.type,
    severity: upperType === 'ACCIDENT' || upperType === 'BREAKDOWN' || upperType === 'CARGO_DAMAGED' ? 'HIGH' : 'MEDIUM',
    status: feStatus,
    db_status: inc.status,
    reported_at: reportedAt ? new Date(reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '09:15',
    location: inc.location || 'Km 18 cao tốc Nội Bài - Bắc Ninh',
    description: inc.description || 'Sự cố phát sinh trên đường vận chuyển',
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

const createIncident = async (payload, userId = 1) => {
  let realTripId = parseInt(payload.trip_id, 10) || null;
  if (typeof payload.trip_id === 'string' && payload.trip_id.toUpperCase().includes('TRIP-')) {
    const foundId = await incidentModel.findTripIdByCode(payload.trip_id);
    if (foundId) realTripId = foundId;
  }
  if (!realTripId) {
    realTripId = await incidentModel.findFirstTripId();
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
  const realId = parseInt(String(id).replace(/^INC-/i, ''), 10) || parseInt(id, 10);
  const rawAction = String(payload.status || payload.action || 'RESOLVED').toUpperCase();

  // 1. Điều xe & tài xế thay thế + Cấp lại Vận đơn phiên bản mới (UC-15, BR-09, UC-41)
  if (
    rawAction === 'RESOLVED_REPLACED' ||
    rawAction === 'REPLACE' ||
    Boolean(payload.new_truck || payload.relief_truck_plate || payload.replacement_reason)
  ) {
    const replaced = await incidentModel.dispatchReplacementWithTransaction({
      incidentId: realId,
      newTruckPlate: payload.new_truck || payload.relief_truck_plate,
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
  const updated = await incidentModel.update(realId, {
    status: 'RESOLVED',
    resolution_note: payload.resolution_note || 'Điều phối viên đã hướng dẫn xử lý xong tại hiện trường',
    resolved_time: new Date()
  });
  return formatIncident(updated);
};

module.exports = {
  formatIncident,
  getAllIncidents,
  createIncident,
  updateIncidentStatus
};
