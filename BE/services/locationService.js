const locationModel = require('../models/locationModel');

const formatLocation = (loc) => {
  let displayType = 'DIEM_GIAO';
  if (loc.type === 'WAREHOUSE') displayType = 'KHO_HANG_KHONG';
  else if (loc.type === 'CUSTOMS_CHECKPOINT') displayType = 'CANG_BIEN';
  else if (loc.name?.toLowerCase().includes('nhà máy')) displayType = 'NHA_MAY';
  else if (loc.name?.toLowerCase().includes('ngoại quan')) displayType = 'KHO_NGOAI_QUAN';

  const cleanLocName = (loc.name || loc.address || 'Điểm giao nhận')
    .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
    .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
    .trim();

  return {
    id: `LOC-${loc.id.toString().padStart(3, '0')}`,
    raw_id: loc.id,
    name: cleanLocName || 'Điểm giao nhận',
    type: displayType,
    customer: loc.customer?.company_name || 'Khách hàng',
    customer_id: loc.customer_id,
    address: loc.address || '',
    province: loc.province_code === 'HN' ? 'Hà Nội' :
              (loc.province_code === 'HP' ? 'Hải Phòng' :
              (loc.province_code === 'BN' ? 'Bắc Ninh' :
              (loc.province_code === 'TN' ? 'Thái Nguyên' : 'Khác'))),
    lat: parseFloat(loc.lat) || 21.0285,
    lng: parseFloat(loc.lng) || 105.8542,
    receiving_hours: (loc.receive_from && loc.receive_to) ? `${loc.receive_from} - ${loc.receive_to}` : '24/7 (Cả tuần)',
    contact_name: loc.contact_name || loc.customer?.company_name || 'Người liên hệ',
    contact_phone: loc.contact_phone || '---',
    geofence_radius_m: loc.radius_m || 200,
    active: true
  };
};

const getAllLocations = async () => {
  const locations = await locationModel.findAll();
  return (locations || []).map(loc => formatLocation(loc));
};

const createLocation = async (payload, userId = 3) => {
  if (!payload.name || !payload.address) {
    throw new Error('Tên và địa chỉ địa điểm là bắt buộc');
  }

  let dbType = 'CUSTOMER_SITE';
  if (payload.type === 'KHO_HANG_KHONG' || payload.type === 'WAREHOUSE') dbType = 'WAREHOUSE';
  else if (payload.type === 'CANG_BIEN' || payload.type === 'CUSTOMS_CHECKPOINT') dbType = 'CUSTOMS_CHECKPOINT';

  let provinceCode = 'HN';
  if (payload.province?.includes('Hải Phòng')) provinceCode = 'HP';
  else if (payload.province?.includes('Bắc Ninh')) provinceCode = 'BN';

  const locationData = {
    name: payload.name.trim(),
    type: dbType,
    customer_id: payload.customer_id ? parseInt(payload.customer_id, 10) : null,
    address: payload.address.trim(),
    province_code: provinceCode,
    lat: payload.lat ? parseFloat(payload.lat) : 21.2187,
    lng: payload.lng ? parseFloat(payload.lng) : 105.8042,
    contact_name: payload.contact_name || null,
    contact_phone: payload.contact_phone || null,
    radius_m: parseInt(payload.geofence_radius_m, 10) || 200,
    created_by: userId
  };

  return await locationModel.create(locationData);
};

const updateLocation = async (id, payload) => {
  const realId = parseInt(id.toString().replace('LOC-', ''), 10) || parseInt(id, 10);

  const updatePayload = {};
  if (payload.name) updatePayload.name = payload.name.trim();
  if (payload.address) updatePayload.address = payload.address.trim();
  if (payload.contact_name) updatePayload.contact_name = payload.contact_name;
  if (payload.contact_phone) updatePayload.contact_phone = payload.contact_phone;
  if (payload.geofence_radius_m) updatePayload.radius_m = parseInt(payload.geofence_radius_m, 10);
  if (payload.lat) updatePayload.lat = parseFloat(payload.lat);
  if (payload.lng) updatePayload.lng = parseFloat(payload.lng);

  return await locationModel.update(realId, updatePayload);
};

const deleteLocation = async (id) => {
  const realId = parseInt(id.toString().replace('LOC-', ''), 10) || parseInt(id, 10);

  // 1. Kiểm tra đơn hàng liên quan
  const relatedOrders = await locationModel.findRelatedOrders(realId);
  if (relatedOrders.length > 0) {
    const activeOrders = relatedOrders.filter(o => !['WAITING_FOR_DOCUMENTS', 'CANCELLED'].includes(o.status));
    if (activeOrders.length > 0) {
      const activeCodes = activeOrders.map(o => o.order_code).filter(Boolean).slice(0, 3).join(', ');
      const err = new Error(`Không thể xóa vì địa điểm đang liên kết với ${activeOrders.length} đơn hàng (${activeCodes}).`);
      err.statusCode = 400;
      throw err;
    }

    await locationModel.reassignOrdersToDefaultLocation(realId, 1);
  }

  // 2. Kiểm tra chuyến xe liên quan
  const relatedTrips = await locationModel.findRelatedTrips(realId);
  if (relatedTrips.length > 0) {
    const tripCodes = relatedTrips.map(t => t.trip_code).filter(Boolean).slice(0, 3).join(', ');
    const err = new Error(`Không thể xóa vì địa điểm đang liên kết với ${relatedTrips.length} chuyến xe (${tripCodes}).`);
    err.statusCode = 400;
    throw err;
  }

  return await locationModel.delete(realId);
};

module.exports = {
  formatLocation,
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation
};

