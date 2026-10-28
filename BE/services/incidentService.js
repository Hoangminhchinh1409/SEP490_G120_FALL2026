const crypto = require('crypto');
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

  const truckObj = inc.trip?.trip_trucks?.[0]?.truck || inc.trip?.truck || {};
  const driverObj = inc.trip?.trip_drivers?.[0]?.driver?.user || inc.trip?.driver?.user || {};
  const reportedAt = inc.reported_time || inc.reported_at || inc.created_at;

  return {
    id: `INC-${inc.id}`,
    raw_id: inc.id,
    trip_code: inc.trip?.trip_code || `TRIP-${inc.trip_id}`,
    truck: truckObj.plate_number || '29H-123.45',
    driver: driverObj.full_name || 'Tài xế',
    phone: driverObj.phone || '0901234567',
    type: typeDisplayMap[inc.type] || inc.type,
    raw_type: inc.type,
    severity: inc.type === 'ACCIDENT' || inc.type === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM',
    status: (inc.status || '').toUpperCase() === 'REPORTED' ? 'PENDING' : inc.status,
    reported_at: reportedAt ? new Date(reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:15',
    location: 'Km 18 cao tốc Nội Bài - Bắc Ninh',
    description: inc.description || 'Sự cố phát sinh trên đường vận chuyển'
  };
};

const getAllIncidents = async () => {
  const incidents = await incidentModel.findAll();
  return (incidents || []).map(inc => formatIncident(inc));
};

const createIncident = async (payload, userId = 3) => {
  let realTripId = parseInt(payload.trip_id, 10) || 1;
  if (typeof payload.trip_id === 'string' && payload.trip_id.includes('TRIP-')) {
    const foundId = await incidentModel.findTripIdByCode(payload.trip_id);
    if (foundId) realTripId = foundId;
  }

  const incidentData = {
    trip_id: realTripId,
    reported_by: userId,
    type: payload.type || 'BREAKDOWN',
    status: 'REPORTED',
    description: payload.description || 'Sự cố phát sinh cần điều phối xử lý',
    reported_at: new Date().toISOString(),
    client_action_id: crypto.randomUUID()
  };

  return await incidentModel.create(incidentData);
};

const updateIncidentStatus = async (id, payload) => {
  const realId = parseInt(id.toString().replace('INC-', ''), 10) || parseInt(id, 10);
  return await incidentModel.update(realId, { status: payload.status || 'RESOLVED' });
};

module.exports = {
  formatIncident,
  getAllIncidents,
  createIncident,
  updateIncidentStatus
};

