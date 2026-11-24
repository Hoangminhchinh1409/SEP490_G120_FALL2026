const locationModel = require('../models/locationModel');
const { validateVietnamAddressText } = require('../utils/addressValidator');

const isAlsWarehouseType = (type) =>
  String(type || '').trim().toUpperCase().replace(/\s+/g, '_') === 'ALS_WAREHOUSE';

const getAlsSortRank = (loc) => {
  const id = Number(loc.raw_id || loc.id);
  if (id === 1) return 0;
  const upperName = String(loc.name || '').toUpperCase();
  if (upperName.includes('MỸ ĐÌNH')) return 1;
  if (upperName.includes('GIA LÂM')) return 2;
  if (upperName.includes('ALSB') || upperName.includes('BẮC NINH')) return 3;
  if (upperName.includes('ALSE') || upperName.includes('ĐÔNG HÀ NỘI')) return 4;
  if (upperName.includes('ALST') || upperName.includes('THÁI NGUYÊN')) return 5;
  return 99;
};

const formatLocation = (loc) => {
  let displayType = 'DIEM_GIAO';
  if (isAlsWarehouseType(loc.type) || loc.type === 'WAREHOUSE' || loc.type === 'Warehouse' || loc.type === 'Company location') displayType = 'KHO_HANG_KHONG';
  else if (loc.type === 'CUSTOMS_CHECKPOINT' || loc.type === 'Customs Checkpoint') displayType = 'CANG_BIEN';
  else if (loc.name?.toLowerCase().includes('nhà máy')) displayType = 'NHA_MAY';
  else if (loc.name?.toLowerCase().includes('ngoại quan')) displayType = 'KHO_NGOAI_QUAN';

  const cleanLocName = (loc.name || loc.address || 'Điểm giao nhận')
    .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
    .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
    .trim();

  // Đọc đúng trường từ schema cơ sở dữ liệu: latitude, longitude, province
  const latVal = loc.latitude !== null && loc.latitude !== undefined ? Number(loc.latitude) : null;
  const lngVal = loc.longitude !== null && loc.longitude !== undefined ? Number(loc.longitude) : null;
  const provinceVal = loc.province || 'Khác';

  const isAlsHub = !loc.customer_id && isAlsWarehouseType(loc.type);

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
    receiving_hours: loc.receiving_hours || '24/7 (Cả tuần)',
    contact_name: loc.contact_name || null,
    contact_phone: loc.contact_phone || null,
    active: true
  };
};

const getAllLocations = async () => {
  const locations = await locationModel.findAll();
  return (locations || []).map(loc => formatLocation(loc));
};

const getAlsWarehouses = async () => {
  const allLocations = await getAllLocations();
  return allLocations
    .filter((loc) => loc.is_als_hub === true)
    .sort((a, b) => {
      const rankDiff = getAlsSortRank(a) - getAlsSortRank(b);
      if (rankDiff !== 0) return rankDiff;
      return Number(a.raw_id || 0) - Number(b.raw_id || 0);
    });
};

const createLocation = async (payload, userId = 3) => {
  if (!payload || !payload.name || !String(payload.name).trim() || !payload.address || !String(payload.address).trim()) {
    throw new Error('Tên và địa chỉ địa điểm là bắt buộc');
  }

  const addrCheck = validateVietnamAddressText(payload.address);
  if (!addrCheck.valid) {
    const err = new Error(addrCheck.reason);
    err.statusCode = 400;
    throw err;
  }

  let dbType = 'CUSTOMER_SITE';
  if (payload.type === 'ALS_WAREHOUSE' || payload.type === 'ALS Warehouse') dbType = 'ALS Warehouse';
  else if (payload.type === 'KHO_HANG_KHONG' || payload.type === 'WAREHOUSE') dbType = 'WAREHOUSE';
  else if (payload.type === 'CANG_BIEN' || payload.type === 'CUSTOMS_CHECKPOINT') dbType = 'CUSTOMS_CHECKPOINT';

  let latVal = null;
  if (payload.lat !== undefined && payload.lat !== null && !isNaN(parseFloat(payload.lat))) {
    latVal = parseFloat(payload.lat);
  } else if (payload.latitude !== undefined && payload.latitude !== null && !isNaN(parseFloat(payload.latitude))) {
    latVal = parseFloat(payload.latitude);
  }

  let lngVal = null;
  if (payload.lng !== undefined && payload.lng !== null && !isNaN(parseFloat(payload.lng))) {
    lngVal = parseFloat(payload.lng);
  } else if (payload.longitude !== undefined && payload.longitude !== null && !isNaN(parseFloat(payload.longitude))) {
    lngVal = parseFloat(payload.longitude);
  }

  if (latVal === null || lngVal === null) {
    const err = new Error('Vui lòng chọn địa chỉ từ VietMap để xác định tọa độ hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  const locationData = {
    name: payload.name.trim(),
    type: dbType,
    customer_id: payload.customer_id ? parseInt(payload.customer_id, 10) : null,
    address: payload.address.trim(),
    province: String(payload.province || 'Hà Nội').replace(/^(Thành phố|Tỉnh)\s+/i, '').trim(),
    latitude: latVal,
    longitude: lngVal,
    contact_name: payload.contact_name?.trim() || null,
    contact_phone: payload.contact_phone?.trim() || null,
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
  if (payload.address) {
    const addrCheck = validateVietnamAddressText(payload.address);
    if (!addrCheck.valid) {
      const err = new Error(addrCheck.reason);
      err.statusCode = 400;
      throw err;
    }
    updatePayload.address = payload.address.trim();
  }
  if (payload.province) updatePayload.province = String(payload.province).replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  if (payload.contact_name !== undefined) updatePayload.contact_name = payload.contact_name?.trim() || null;
  if (payload.contact_phone !== undefined) updatePayload.contact_phone = payload.contact_phone?.trim() || null;

  const rawLat = payload.lat !== undefined ? payload.lat : payload.latitude;
  if (rawLat !== undefined && rawLat !== null && !isNaN(parseFloat(rawLat))) {
    updatePayload.latitude = parseFloat(rawLat);
  }
  const rawLng = payload.lng !== undefined ? payload.lng : payload.longitude;
  if (rawLng !== undefined && rawLng !== null && !isNaN(parseFloat(rawLng))) {
    updatePayload.longitude = parseFloat(rawLng);
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
  isAlsWarehouseType,
  formatLocation,
  getAllLocations,
  getAlsWarehouses,
  createLocation,
  updateLocation,
  deleteLocation
};

