const locationModel = require('../models/locationModel');

const formatLocation = (loc) => {
  let displayType = 'DIEM_GIAO';
  if (loc.type === 'WAREHOUSE' || loc.type === 'Warehouse' || loc.type === 'Company location') displayType = 'KHO_HANG_KHONG';
  else if (loc.type === 'CUSTOMS_CHECKPOINT' || loc.type === 'Customs Checkpoint') displayType = 'CANG_BIEN';
  else if (loc.name?.toLowerCase().includes('nhà máy')) displayType = 'NHA_MAY';
  else if (loc.name?.toLowerCase().includes('ngoại quan')) displayType = 'KHO_NGOAI_QUAN';

  const cleanLocName = (loc.name || loc.address || 'Điểm giao nhận')
    .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
    .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
    .trim();

  // Đọc đúng trường từ schema cơ sở dữ liệu: latitude, longitude, province, geofence_radius
  const latVal = loc.latitude !== null && loc.latitude !== undefined ? Number(loc.latitude) : (parseFloat(loc.lat) || 21.0285);
  const lngVal = loc.longitude !== null && loc.longitude !== undefined ? Number(loc.longitude) : (parseFloat(loc.lng) || 105.8542);
  const provinceVal = loc.province || (loc.province_code === 'HN' ? 'Hà Nội' :
                      (loc.province_code === 'HP' ? 'Hải Phòng' :
                      (loc.province_code === 'BN' ? 'Bắc Ninh' :
                      (loc.province_code === 'TN' ? 'Thái Nguyên' : 'Khác'))));

  const isAlsHub = !loc.customer_id && (
    loc.type === 'Warehouse' || loc.type === 'Company location' || loc.type === 'Customs Checkpoint' ||
    loc.name?.toUpperCase().includes('ALS') || loc.name?.includes('Cửa khẩu')
  );

  return {
    id: `LOC-${loc.id.toString().padStart(3, '0')}`,
    raw_id: loc.id,
    name: cleanLocName || 'Điểm giao nhận',
    type: displayType,
    customer: loc.customer?.company_name || 'Khách hàng',
    customer_id: loc.customer_id,
    is_als_hub: Boolean(isAlsHub),
    address: loc.address || '',
    province: provinceVal,
    lat: latVal,
    lng: lngVal,
    receiving_hours: loc.receiving_hours || ((loc.receive_from && loc.receive_to) ? `${loc.receive_from} - ${loc.receive_to}` : '24/7 (Cả tuần)'),
    contact_name: loc.contact_name || loc.customer?.company_name || 'Người liên hệ',
    contact_phone: loc.contact_phone || '---',
    geofence_radius_m: loc.geofence_radius || loc.radius_m || 200,
    active: true
  };
};

const getAllLocations = async () => {
  const locations = await locationModel.findAll();
  return (locations || []).map(loc => formatLocation(loc));
};

const createLocation = async (payload, userId = 3) => {
  if (!payload || !payload.name || !String(payload.name).trim() || !payload.address || !String(payload.address).trim()) {
    throw new Error('Tên và địa chỉ địa điểm là bắt buộc');
  }

  let dbType = 'CUSTOMER_SITE';
  if (payload.type === 'KHO_HANG_KHONG' || payload.type === 'WAREHOUSE') dbType = 'WAREHOUSE';
  else if (payload.type === 'CANG_BIEN' || payload.type === 'CUSTOMS_CHECKPOINT') dbType = 'CUSTOMS_CHECKPOINT';

  let provinceCode = 'HN';
  if (payload.province_code) {
    provinceCode = payload.province_code;
  } else if (payload.province) {
    const provStr = String(payload.province).toLowerCase();
    if (provStr.includes('hải phòng') || provStr === 'hp') provinceCode = 'HP';
    else if (provStr.includes('bắc ninh') || provStr === 'bn') provinceCode = 'BN';
    else if (provStr.includes('thái nguyên') || provStr === 'tn') provinceCode = 'TN';
    else if (provStr.includes('hà nội') || provStr === 'hn') provinceCode = 'HN';
    else provinceCode = 'HN';
  }

  let latVal = 21.2187;
  if (payload.lat !== undefined && payload.lat !== null && !isNaN(parseFloat(payload.lat))) {
    latVal = parseFloat(payload.lat);
  } else if (payload.latitude !== undefined && payload.latitude !== null && !isNaN(parseFloat(payload.latitude))) {
    latVal = parseFloat(payload.latitude);
  }

  let lngVal = 105.8042;
  if (payload.lng !== undefined && payload.lng !== null && !isNaN(parseFloat(payload.lng))) {
    lngVal = parseFloat(payload.lng);
  } else if (payload.longitude !== undefined && payload.longitude !== null && !isNaN(parseFloat(payload.longitude))) {
    lngVal = parseFloat(payload.longitude);
  }

  let radiusM = 200;
  const radiusInput = payload.geofence_radius_m !== undefined ? payload.geofence_radius_m : payload.geofence_radius;
  if (radiusInput !== undefined && radiusInput !== null && !isNaN(parseInt(radiusInput, 10))) {
    radiusM = parseInt(radiusInput, 10);
  }

  const locationData = {
    name: payload.name.trim(),
    type: dbType,
    customer_id: payload.customer_id ? parseInt(payload.customer_id, 10) : null,
    address: payload.address.trim(),
    province: payload.province || 'Hà Nội',
    province_code: provinceCode,
    latitude: latVal,
    longitude: lngVal,
    lat: latVal,
    lng: lngVal,
    contact_name: payload.contact_name || null,
    contact_phone: payload.contact_phone || null,
    geofence_radius: radiusM,
    radius_m: radiusM,
    created_by: userId
  };

  return await locationModel.create(locationData);
};

const updateLocation = async (id, payload) => {
  if (id === undefined || id === null) {
    const err = new Error('Mã địa điểm không hợp lệ');
    err.statusCode = 400;
    throw err;
  }
  const cleanIdStr = String(id).replace(/^LOC-/i, '').trim();
  const realId = parseInt(cleanIdStr, 10);
  if (isNaN(realId) || realId <= 0) {
    const err = new Error('Mã địa điểm không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  const updatePayload = {};
  if (payload.name) updatePayload.name = payload.name.trim();
  if (payload.address) updatePayload.address = payload.address.trim();
  if (payload.province) updatePayload.province = payload.province;
  if (payload.contact_name !== undefined) updatePayload.contact_name = payload.contact_name;
  if (payload.contact_phone !== undefined) updatePayload.contact_phone = payload.contact_phone;

  if (payload.geofence_radius_m !== undefined) {
    const r = parseInt(payload.geofence_radius_m, 10);
    if (!isNaN(r)) {
      updatePayload.geofence_radius = r;
      updatePayload.radius_m = r;
    }
  }
  if (payload.lat !== undefined) {
    const lt = parseFloat(payload.lat);
    if (!isNaN(lt)) {
      updatePayload.latitude = lt;
      updatePayload.lat = lt;
    }
  }
  if (payload.lng !== undefined) {
    const lg = parseFloat(payload.lng);
    if (!isNaN(lg)) {
      updatePayload.longitude = lg;
      updatePayload.lng = lg;
    }
  }

  return await locationModel.update(realId, updatePayload);
};

const deleteLocation = async (id) => {
  if (id === undefined || id === null) {
    const err = new Error('Mã địa điểm không hợp lệ');
    err.statusCode = 400;
    throw err;
  }
  const cleanIdStr = String(id).replace(/^LOC-/i, '').trim();
  const realId = parseInt(cleanIdStr, 10);
  if (isNaN(realId) || realId <= 0) {
    const err = new Error('Mã địa điểm không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  // 1. Kiểm tra chuyến xe liên quan TRƯỚC (UTC-LC-047: Do NOT reassign orders if trips exist!)
  const relatedTrips = await locationModel.findRelatedTrips(realId);
  if (relatedTrips && relatedTrips.length > 0) {
    const tripCodes = relatedTrips.map(t => t.trip_code).filter(Boolean).slice(0, 3).join(', ');
    const err = new Error(`Không thể xóa vì địa điểm đang liên kết với ${relatedTrips.length} chuyến xe (${tripCodes}).`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Kiểm tra đơn hàng liên quan
  const relatedOrders = await locationModel.findRelatedOrders(realId);
  if (relatedOrders && relatedOrders.length > 0) {
    const activeOrders = relatedOrders.filter(o => !['WAITING_FOR_DOCUMENTS', 'CANCELLED'].includes(o.status));
    if (activeOrders.length > 0) {
      const activeCodes = activeOrders.map(o => o.order_code).filter(Boolean).slice(0, 3).join(', ');
      const err = new Error(`Không thể xóa vì địa điểm đang liên kết với ${activeOrders.length} đơn hàng (${activeCodes}).`);
      err.statusCode = 400;
      throw err;
    }

    await locationModel.reassignOrdersToDefaultLocation(realId, 1);
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

