const supabase = require('../../config/supabase');

// Lấy danh sách địa điểm
const getAllLocations = async (req, res) => {
  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select(`
        *,
        customer:customers(id, company_name, tax_code)
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllLocations error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách địa điểm', error });
    }

    const formattedLocations = (locations || []).map(loc => {
      let displayType = 'DIEM_GIAO';
      if (loc.type === 'WAREHOUSE') displayType = 'KHO_HANG_KHONG';
      else if (loc.type === 'CUSTOMS_CHECKPOINT') displayType = 'CANG_BIEN';
      else if (loc.name?.toLowerCase().includes('nhà máy')) displayType = 'NHA_MAY';
      else if (loc.name?.toLowerCase().includes('ngoại quan')) displayType = 'KHO_NGOAI_QUAN';

      // Loại bỏ tiền tố và ghi chú điểm lấy/giao
      let cleanLocName = (loc.name || loc.address || 'Điểm giao nhận')
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
    });

    return res.json({ locations: formattedLocations });
  } catch (err) {
    console.error('getAllLocations exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Tạo địa điểm mới
const createLocation = async (req, res) => {
  try {
    const {
      name,
      type,
      address,
      province,
      lat,
      lng,
      contact_name,
      contact_phone,
      geofence_radius_m,
      customer_id
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: 'Tên và địa chỉ địa điểm là bắt buộc' });
    }

    let dbType = 'CUSTOMER_SITE';
    if (type === 'KHO_HANG_KHONG' || type === 'WAREHOUSE') dbType = 'WAREHOUSE';
    else if (type === 'CANG_BIEN' || type === 'CUSTOMS_CHECKPOINT') dbType = 'CUSTOMS_CHECKPOINT';

    let provinceCode = 'HN';
    if (province?.includes('Hải Phòng')) provinceCode = 'HP';
    else if (province?.includes('Bắc Ninh')) provinceCode = 'BN';

    const { data: newLoc, error } = await supabase
      .from('locations')
      .insert([{
        name: name.trim(),
        type: dbType,
        customer_id: customer_id ? parseInt(customer_id) : null,
        address: address.trim(),
        province_code: provinceCode,
        lat: lat ? parseFloat(lat) : 21.2187,
        lng: lng ? parseFloat(lng) : 105.8042,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        radius_m: parseInt(geofence_radius_m) || 200,
        created_by: 3
      }])
      .select();

    if (error) {
      console.error('createLocation error:', error);
      return res.status(500).json({ message: 'Lỗi thêm địa điểm', error });
    }

    return res.status(201).json({ message: 'Thêm địa điểm thành công', location: newLoc[0] });
  } catch (err) {
    console.error('createLocation exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật địa điểm
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const realId = parseInt(id.replace('LOC-', '')) || parseInt(id);

    const {
      name,
      address,
      contact_name,
      contact_phone,
      geofence_radius_m,
      lat,
      lng
    } = req.body;

    const updatePayload = {};
    if (name) updatePayload.name = name.trim();
    if (address) updatePayload.address = address.trim();
    if (contact_name) updatePayload.contact_name = contact_name;
    if (contact_phone) updatePayload.contact_phone = contact_phone;
    if (geofence_radius_m) updatePayload.radius_m = parseInt(geofence_radius_m);
    if (lat) updatePayload.lat = parseFloat(lat);
    if (lng) updatePayload.lng = parseFloat(lng);

    const { data: updated, error } = await supabase
      .from('locations')
      .update(updatePayload)
      .eq('id', realId)
      .select();

    if (error) {
      console.error('updateLocation error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật địa điểm', error });
    }

    return res.json({ message: 'Cập nhật địa điểm thành công', location: updated[0] });
  } catch (err) {
    console.error('updateLocation exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Xóa địa điểm
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const realId = parseInt(id.replace('LOC-', '')) || parseInt(id);

    // 1. Kiểm tra đơn hàng liên quan
    const { data: relatedOrders } = await supabase
      .from('orders')
      .select('id, order_code, status')
      .or(`pickup_location_id.eq.${realId},delivery_location_id.eq.${realId}`);

    if (relatedOrders && relatedOrders.length > 0) {
      // Đơn hàng đang vận chuyển thực tế không được xóa địa điểm
      const activeOrders = relatedOrders.filter(o => !['WAITING_FOR_DOCUMENTS', 'CANCELLED'].includes(o.status));
      if (activeOrders.length > 0) {
        const activeCodes = activeOrders.map(o => o.order_code).filter(Boolean).slice(0, 3).join(', ');
        return res.status(400).json({
          message: `Không thể xóa vì địa điểm đang liên kết với ${activeOrders.length} đơn hàng (${activeCodes}).`
        });
      }

      // Đối với các đơn hàng nháp / tư vấn trực tuyến (WAITING_FOR_DOCUMENTS), chuyển về kho mặc định 1
      await supabase
        .from('orders')
        .update({ pickup_location_id: 1 })
        .eq('pickup_location_id', realId);

      await supabase
        .from('orders')
        .update({ delivery_location_id: 1 })
        .eq('delivery_location_id', realId);
    }

    // 2. Kiểm tra chuyến xe liên quan
    const { data: relatedTrips } = await supabase
      .from('trips')
      .select('id, trip_code')
      .or(`origin_location_id.eq.${realId},destination_location_id.eq.${realId}`);

    if (relatedTrips && relatedTrips.length > 0) {
      const tripCodes = relatedTrips.map(t => t.trip_code).filter(Boolean).slice(0, 3).join(', ');
      return res.status(400).json({
        message: `Không thể xóa vì địa điểm đang liên kết với ${relatedTrips.length} chuyến xe (${tripCodes}).`
      });
    }

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', realId);

    if (error) {
      console.error('deleteLocation error:', error);
      if (error.code === '23503') {
        return res.status(400).json({ 
          message: 'Không thể xóa địa điểm này do ràng buộc dữ liệu lịch sử trong hệ thống.',
          error 
        });
      }
      return res.status(500).json({ message: error.message || 'Lỗi xóa địa điểm', error });
    }

    return res.json({ message: 'Đã xóa địa điểm thành công' });
  } catch (err) {
    console.error('deleteLocation exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 3. CONTRACTS MANAGEMENT (HỢP ĐỒNG VẬN TẢI)
// ==========================================

module.exports = {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation
};