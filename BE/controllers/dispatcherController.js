const supabase = require('../config/supabase');
const crypto = require('crypto');

// ==========================================
// 1. FLEET MANAGEMENT (ĐỘI XE & TÀI XẾ & ĐỐI TÁC)
// ==========================================

// Helper xác định tên dòng xe theo tải trọng
const getTruckModelName = (payloadKg) => {
  const p = Number(payloadKg) || 1250;
  if (p <= 1500) return 'Thaco Frontier 1.25T';
  if (p <= 2500) return 'Thaco Ollin 2.5T';
  if (p <= 5000) return 'Thaco Auman 4.0T';
  if (p <= 8000) return 'Hino 500 Series 8T';
  return 'Đầu kéo Container Dongfeng';
};

// Helper xác định phân loại xe
const getTruckCategory = (payloadKg) => {
  const p = Number(payloadKg) || 1250;
  if (p <= 1500) return 'Xe tải nhẹ';
  if (p <= 3500) return 'Xe tải trung';
  if (p <= 10000) return 'Xe tải nặng';
  return 'Xe đầu kéo';
};

// Lấy danh sách phương tiện vận tải
const getFleetTrucks = async (req, res) => {
  try {
    const { data: trucks, error } = await supabase
      .from('trucks')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('getFleetTrucks error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách xe', error });
    }

    const formattedTrucks = (trucks || []).map(t => {
      const volM3 = (t.box_length_cm && t.box_width_cm && t.box_height_cm)
        ? parseFloat(((t.box_length_cm * t.box_width_cm * t.box_height_cm) / 1000000).toFixed(1))
        : parseFloat(((t.payload_kg * 0.0068) || 9.5).toFixed(1));

      return {
        key: t.id.toString(),
        id: t.id,
        plate: t.plate_number,
        model: getTruckModelName(t.payload_kg),
        category: getTruckCategory(t.payload_kg),
        payload_kg: t.payload_kg || 1250,
        volume_m3: volM3,
        box_length_cm: t.box_length_cm,
        box_width_cm: t.box_width_cm,
        box_height_cm: t.box_height_cm,
        cargo_type: t.payload_kg > 10000 ? 'Moóc xương Container' : 'Thùng kín inox',
        equipment: 'Kẹp chì niêm phong, GPS, Cảm biến hành trình',
        assigned_driver: 'Nguyễn Văn Tài',
        driver_phone: '0901234567',
        location: 'Depot Cảng HKQT Nội Bài',
        registration_exp: t.inspection_expiry || '2027-05-15',
        insurance_exp: t.insurance_expiry || '2027-06-01',
        status: t.status || 'AVAILABLE',
        license_class_required: t.license_class_required || 'B2'
      };
    });

    return res.json({ trucks: formattedTrucks });
  } catch (err) {
    console.error('getFleetTrucks exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Tạo phương tiện mới
const createFleetTruck = async (req, res) => {
  try {
    const {
      plate_number,
      payload_kg,
      box_length_cm,
      box_width_cm,
      box_height_cm,
      license_class_required,
      inspection_expiry,
      insurance_expiry
    } = req.body;

    if (!plate_number) {
      return res.status(400).json({ message: 'Biển số xe là bắt buộc' });
    }

    const { data: newTruck, error } = await supabase
      .from('trucks')
      .insert([{
        plate_number: plate_number.trim(),
        payload_kg: parseInt(payload_kg) || 1250,
        box_length_cm: parseInt(box_length_cm) || 310,
        box_width_cm: parseInt(box_width_cm) || 160,
        box_height_cm: parseInt(box_height_cm) || 170,
        license_class_required: license_class_required || 'B2',
        inspection_expiry: inspection_expiry || '2027-12-31',
        insurance_expiry: insurance_expiry || '2027-12-31',
        status: 'AVAILABLE'
      }])
      .select();

    if (error) {
      console.error('createFleetTruck error:', error);
      return res.status(500).json({ message: 'Không thể thêm phương tiện', error });
    }

    return res.status(201).json({ message: 'Thêm xe thành công', truck: newTruck[0] });
  } catch (err) {
    console.error('createFleetTruck exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật phương tiện (trạng thái, bảo dưỡng, kích thước)
const updateFleetTruck = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payload_kg, inspection_expiry, insurance_expiry } = req.body;

    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (payload_kg) updatePayload.payload_kg = parseInt(payload_kg);
    if (inspection_expiry) updatePayload.inspection_expiry = inspection_expiry;
    if (insurance_expiry) updatePayload.insurance_expiry = insurance_expiry;

    const { data: updated, error } = await supabase
      .from('trucks')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('updateFleetTruck error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật phương tiện', error });
    }

    return res.json({ message: 'Cập nhật thành công', truck: updated[0] });
  } catch (err) {
    console.error('updateFleetTruck exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách tài xế
const getFleetDrivers = async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('driver_profiles')
      .select(`
        id,
        user_id,
        license_number,
        license_class,
        license_expiry,
        status,
        last_trip_ended_at,
        user:users(id, username, full_name, phone, email, status)
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('getFleetDrivers error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách tài xế', error });
    }

    const formattedDrivers = (profiles || []).map((d, index) => {
      const u = d.user || {};
      const statusMap = {
        'ACTIVE': 'AVAILABLE',
        'ON_TRIP': 'ON_DUTY',
        'RESTING': 'RESTING',
        'INACTIVE': 'RESTING'
      };

      return {
        key: `D${d.id}`,
        id: d.id,
        user_id: d.user_id,
        name: u.full_name || `Tài xế ${d.id}`,
        phone: u.phone || '0901234567',
        email: u.email || '',
        id_card: u.username?.includes('driver_') ? `0385722${d.id}9` : (u.username || '0385722949'),
        license_type: `Hạng ${d.license_class || 'C'}`,
        license_class: d.license_class || 'C',
        license_number: d.license_number,
        license_expiry: d.license_expiry,
        experience_years: `${3 + d.id * 2} năm kinh nghiệm`,
        shift_hours_today: index === 0 ? 3.5 : 2.0,
        max_shift_hours: 8.0,
        assigned_truck: index === 0 ? '29H-123.45' : '29H-543.21',
        current_trip: null,
        status: statusMap[d.status] || 'AVAILABLE',
        raw_status: d.status
      };
    });

    return res.json({ drivers: formattedDrivers });
  } catch (err) {
    console.error('getFleetDrivers exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật trạng thái tài xế
const updateFleetDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, license_class, license_expiry } = req.body;

    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (license_class) updatePayload.license_class = license_class;
    if (license_expiry) updatePayload.license_expiry = license_expiry;

    const { data: updated, error } = await supabase
      .from('driver_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('updateFleetDriver error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật tài xế', error });
    }

    return res.json({ message: 'Cập nhật thành công', driver: updated[0] });
  } catch (err) {
    console.error('updateFleetDriver exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách đối tác vận tải (Vendors)
const getFleetVendors = async (req, res) => {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('getFleetVendors error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách đối tác', error });
    }

    const formattedVendors = (vendors || []).map(v => ({
      id: v.id.toString(),
      key: v.id.toString(),
      name: v.company_name,
      contact_person: v.contact_person,
      phone: v.phone,
      truck_types: v.truck_types,
      status: v.approval_status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      rating: 4.8
    }));

    return res.json({ vendors: formattedVendors });
  } catch (err) {
    console.error('getFleetVendors exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 2. LOCATIONS MANAGEMENT (QUẢN LÝ ĐỊA ĐIỂM)
// ==========================================

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

      return {
        id: `LOC-${loc.id.toString().padStart(3, '0')}`,
        raw_id: loc.id,
        name: loc.name || loc.address || 'Điểm giao nhận',
        type: displayType,
        customer: loc.customer?.company_name || 'Khách hàng NEXLOG',
        customer_id: loc.customer_id,
        address: loc.address || '',
        province: loc.province_code === 'HN' ? 'Hà Nội' : 
                  (loc.province_code === 'HP' ? 'Hải Phòng' : 
                  (loc.province_code === 'BN' ? 'Bắc Ninh' : 
                  (loc.province_code === 'TN' ? 'Thái Nguyên' : 'Khác'))),
        lat: parseFloat(loc.lat) || 21.0285,
        lng: parseFloat(loc.lng) || 105.8542,
        receiving_hours: (loc.receive_from && loc.receive_to) ? `${loc.receive_from} - ${loc.receive_to}` : '24/7 (Cả tuần)',
        contact_name: loc.contact_name || 'Bộ phận Giao nhận',
        contact_phone: loc.contact_phone || '0988.123.456',
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

// Lấy danh sách hợp đồng
const getAllContracts = async (req, res) => {
  try {
    let { data: contracts, error } = await supabase
      .from('transport_contracts')
      .select(`
        *,
        customer:customers(id, company_name, tax_code, email),
        vendor:vendors(id, company_name, phone)
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllContracts error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách hợp đồng', error });
    }

    // Nếu bảng chưa có hợp đồng nào, tự động seed hợp đồng mẫu cho khách hàng thật trong DB
    if (!contracts || contracts.length === 0) {
      const { data: customers } = await supabase.from('customers').select('id, company_name, tax_code').limit(3);
      if (customers && customers.length > 0) {
        const seedPayload = customers.map((c, i) => ({
          contract_number: `NEX/2026/HDVT-${c.company_name.slice(0, 5).toUpperCase().replace(/[^A-Z]/g, '')}-0${i + 1}`,
          customer_id: c.id,
          terms: 'Vận chuyển hàng hóa nguyên chuyến có bảo hiểm và kẹp chì điện tử',
          pricing_conditions: 'Bảng cước cố định năm 2026',
          compensation_rules: 'Bồi thường 100% giá trị hàng hóa nếu hư hỏng hoặc mất niêm phong',
          free_waiting_minutes: 60,
          waiting_fee_per_hour: 150000,
          cancellation_fee_tiers: { before_4h: 30, after_dispatch: 70 },
          liability_cap: 200000000,
          signed_on: '2026-01-01',
          valid_from: '2026-01-01',
          valid_to: '2026-12-31',
          status: 'ACTIVE'
        }));

        await supabase.from('transport_contracts').insert(seedPayload);
        const { data: reloaded } = await supabase
          .from('transport_contracts')
          .select(`
            *,
            customer:customers(id, company_name, tax_code, email),
            vendor:vendors(id, company_name, phone)
          `)
          .order('id', { ascending: false });
        contracts = reloaded || [];
      }
    }

    const formattedContracts = (contracts || []).map(c => {
      const isVendor = !!c.vendor_id;
      const partnerName = isVendor
        ? (c.vendor?.company_name || 'Đối tác vận tải 3PL')
        : (c.customer?.company_name || 'Công ty TNHH ADTEK Việt Nam');
      const taxCode = isVendor ? '0304556677' : (c.customer?.tax_code || '0108992834');

      return {
        id: `HD-2026-${c.id}`,
        raw_id: c.id,
        contract_no: c.contract_number,
        party_type: isVendor ? 'VENDOR' : 'CUSTOMER',
        partner_name: partnerName,
        tax_code: taxCode,
        start_date: c.valid_from || '2026-01-01',
        end_date: c.valid_to || '2026-12-31',
        free_waiting_mins: c.free_waiting_minutes || 60,
        waiting_fee_per_hour: c.waiting_fee_per_hour || 150000,
        cancellation_tiers: 'Hủy trước 4h: Phạt 30% cước | Sau khi điều xe: Phạt 70% cước',
        liability_cap_vnd: c.liability_cap || 200000000,
        liability_cap_type: '100% giá trị khai báo có seal nguyên chì',
        status: c.status || 'ACTIVE',
        signed_by: 'Hoàng Minh Chính - GĐ Vận hành'
      };
    });

    return res.json({ contracts: formattedContracts });
  } catch (err) {
    console.error('getAllContracts exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Tạo hợp đồng mới
const createContract = async (req, res) => {
  try {
    const {
      contract_no,
      party_type,
      partner_id,
      start_date,
      end_date,
      free_waiting_mins,
      waiting_fee_per_hour,
      liability_cap_vnd,
      status
    } = req.body;

    const isVendor = party_type === 'VENDOR';

    const { data: newContract, error } = await supabase
      .from('transport_contracts')
      .insert([{
        contract_number: contract_no || `NEX/2026/HDVT-${Math.floor(100 + Math.random() * 900)}`,
        customer_id: !isVendor ? (partner_id || 1) : null,
        vendor_id: isVendor ? (partner_id || 1) : null,
        terms: 'Hợp đồng vận chuyển tiêu chuẩn dịch vụ ALS Logistics',
        free_waiting_minutes: parseInt(free_waiting_mins) || 60,
        waiting_fee_per_hour: parseInt(waiting_fee_per_hour) || 150000,
        liability_cap: parseInt(liability_cap_vnd) || 200000000,
        valid_from: start_date || '2026-01-01',
        valid_to: end_date || '2026-12-31',
        signed_on: start_date || '2026-01-01',
        status: status || 'ACTIVE'
      }])
      .select();

    if (error) {
      console.error('createContract error:', error);
      return res.status(500).json({ message: 'Lỗi thêm hợp đồng', error });
    }

    return res.status(201).json({ message: 'Tạo hợp đồng thành công', contract: newContract[0] });
  } catch (err) {
    console.error('createContract exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách khách hàng để chọn trong dropdown
const getAllCustomers = async (req, res) => {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, company_name, tax_code, email')
      .order('id', { ascending: true });

    if (error) {
      console.error('getAllCustomers error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách khách hàng', error });
    }

    return res.json({ customers });
  } catch (err) {
    console.error('getAllCustomers exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 4. TRIP PLANNING & MONITORING (LẬP CHUYẾN & GIÁM SÁT)
// ==========================================

// Lấy danh sách các chuyến xe
const getAllTrips = async (req, res) => {
  try {
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        truck:trucks(id, plate_number, payload_kg, status),
        driver:driver_profiles!trips_driver_id_fkey(
          id,
          user:users(id, full_name, phone)
        ),
        stops:trip_stops(
          id,
          seq,
          type,
          location_id,
          address,
          status,
          eta_at,
          arrived_at,
          done_at,
          location:locations(id, name, address, lat, lng)
        ),
        incidents:incidents!incidents_trip_id_fkey(
          id,
          type,
          status,
          description,
          reported_at
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllTrips error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách chuyến xe', error });
    }

    const formattedTrips = (trips || []).map(trip => {
      const truckObj = trip.truck || {};
      const driverObj = trip.driver?.user || {};
      const sortedStops = (trip.stops || []).sort((a, b) => (a.seq || 0) - (b.seq || 0));

      const pickupStop = sortedStops.find(s => s.type === 'PICKUP') || sortedStops[0] || {};
      const dropoffStop = sortedStops.find(s => s.type === 'DROPOFF') || sortedStops[sortedStops.length - 1] || {};

      const hasIncident = trip.incidents && trip.incidents.length > 0;
      const latestIncident = hasIncident ? trip.incidents[0] : null;

      let progress = 10;
      if (trip.status === 'COMPLETED') progress = 100;
      else if (trip.status === 'IN_PROGRESS') progress = 60;
      else if (trip.status === 'ASSIGNED') progress = 20;

      return {
        id: trip.trip_code,
        raw_id: trip.id,
        plate: truckObj.plate_number || '29H-123.45',
        truck_model: getTruckModelName(truckObj.payload_kg),
        driver_name: driverObj.full_name || 'Nguyễn Văn Tài',
        driver_phone: driverObj.phone || '0901234567',
        orders: [trip.waybill_no || `ORD-${trip.id}`],
        customer: 'Khách hàng vận tải',
        pickup: pickupStop.address || pickupStop.location?.name || 'Kho ALS Cảng HKQT Nội Bài',
        dropoff: dropoffStop.address || dropoffStop.location?.name || 'KCN Tiên Sơn, Bắc Ninh',
        planned_start: trip.planned_start_at ? new Date(trip.planned_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30',
        planned_finish: '14:30',
        actual_start: trip.planned_start_at ? new Date(trip.planned_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:42',
        status: trip.status === 'IN_PROGRESS' ? 'IN_TRANSIT' : (trip.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED'),
        is_late_risk: hasIncident,
        late_reason: latestIncident ? latestIncident.description : null,
        has_incident: hasIncident,
        incident_id: latestIncident ? `INC-${latestIncident.id}` : null,
        progress,
        seal_number: `SEAL-VN-${trip.id * 1111}`,
        seal_photo_url: '/assets/hero.png',
        waybill_version: trip.waybill_version || 1,
        stops: sortedStops.length > 0 ? sortedStops.map(s => ({
          id: s.id,
          name: s.location?.name || s.address || 'Điểm dừng',
          type: s.type,
          planned: s.eta_at ? new Date(s.eta_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00',
          actual: s.arrived_at ? new Date(s.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Đang di chuyển',
          event: s.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang di chuyển',
          note: s.type === 'PICKUP' ? 'Đã kẹp chì niêm phong' : 'Chờ giao hàng và ký POD'
        })) : [
          { id: 1, name: 'Kho ALS Cảng HKQT Nội Bài', type: 'PICKUP', planned: '08:30', actual: '08:40', event: 'Đã xuất phát', note: 'Niêm phong chì nguyên vẹn' },
          { id: 2, name: 'Điểm giao nhận', type: 'DROPOFF', planned: '14:30', actual: 'Dự kiến 14:15', event: 'Đang vận chuyển', note: 'Chờ nhận hàng và đối soát POD' }
        ]
      };
    });

    return res.json({ trips: formattedTrips });
  } catch (err) {
    console.error('getAllTrips exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Gán xe và lập chuyến (Tạo Trip trong DB)
const createTrip = async (req, res) => {
  try {
    const {
      order_id,
      order_code,
      truck_plate,
      driver_name,
      pickup_address,
      dropoff_address,
      allocation_type,
      vendor_name,
      vendor_tracking_code
    } = req.body;

    // 1. Tìm truck_id theo plate
    let truckId = null;
    if (truck_plate) {
      const { data: trk } = await supabase.from('trucks').select('id').eq('plate_number', truck_plate).limit(1);
      if (trk && trk.length > 0) truckId = trk[0].id;
    }
    if (!truckId) {
      const { data: trkFirst } = await supabase.from('trucks').select('id').limit(1);
      if (trkFirst && trkFirst.length > 0) truckId = trkFirst[0].id;
    }

    // 2. Tìm driver_id
    let driverId = 1;
    const { data: drv } = await supabase.from('driver_profiles').select('id').limit(1);
    if (drv && drv.length > 0) driverId = drv[0].id;

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tripCode = `TRIP-${randomNum}`;
    // Mã vận đơn thống nhất của hệ thống: NEX - XXXXXX cho xe nội bộ, hoặc mã vận đơn đối tác cho vendor ngoài
    const waybillNo = allocation_type === 'VENDOR'
      ? (vendor_tracking_code?.trim() || '')
      : `NEX-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Insert vào bảng trips
    const { data: newTrip, error: tripErr } = await supabase
      .from('trips')
      .insert([{
        trip_code: tripCode,
        status: 'IN_PROGRESS',
        planned_start_at: new Date().toISOString(),
        total_weight_kg: 1500,
        total_volume_m3: 10.5,
        truck_id: truckId,
        driver_id: driverId,
        waybill_no: waybillNo || `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
        waybill_version: 1,
        created_by: 3
      }])
      .select();

    if (tripErr) {
      console.error('createTrip insert error:', tripErr);
      return res.status(500).json({ message: 'Không thể lập chuyến trên cơ sở dữ liệu', error: tripErr });
    }

    const tripId = newTrip[0].id;

    // 4. Tạo 2 điểm dừng (trip_stops: PICKUP & DROPOFF)
    const { data: stop1 } = await supabase.from('trip_stops').insert([{
      trip_id: tripId,
      seq: 1,
      type: 'PICKUP',
      location_id: 1,
      address: pickup_address || 'Kho ALS Cảng HKQT Nội Bài',
      status: 'COMPLETED',
      arrived_at: new Date().toISOString()
    }]).select();

    const { data: stop2 } = await supabase.from('trip_stops').insert([{
      trip_id: tripId,
      seq: 2,
      type: 'DROPOFF',
      location_id: 1,
      address: dropoff_address || 'KCN Tiên Sơn, Bắc Ninh',
      status: 'PENDING'
    }]).select();

    // 5. Cập nhật trạng thái đơn hàng sang ASSIGNED (hoặc HANDED_OVER_VENDOR) và gắn mã vận đơn
    const cleanOrderId = parseInt(order_id) || null;
    const orderUpdatePayload = {
      status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED'
    };
    if (waybillNo) {
      orderUpdatePayload.order_code = waybillNo;
    }

    if (cleanOrderId) {
      await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', cleanOrderId);

      // Liên kết stop với order
      if (stop1 && stop1[0]) {
        await supabase.from('trip_stop_orders').insert([{
          trip_stop_id: stop1[0].id,
          order_id: cleanOrderId
        }]).select();
      }

      // Ghi chú lịch sử
      await supabase.from('order_status_history').insert([{
        order_id: cleanOrderId,
        from_status: 'READY_FOR_PLANNING',
        to_status: allocation_type === 'VENDOR' ? 'HANDED_OVER_VENDOR' : 'ASSIGNED',
        notes: allocation_type === 'VENDOR'
          ? `Đã phân bổ cho nhà xe đối tác [${vendor_name || 'Đối tác vận tải'}]. Mã vận đơn đối tác: ${waybillNo || 'Chưa nhập'}`
          : `Đã phân bổ chuyến xe ${tripCode} (Xe nội bộ: ${truck_plate || 'Nội bộ'}, Lái xe: ${driver_name || 'Nội bộ'}). Khởi tạo mã vận đơn hệ thống: ${waybillNo}`,
        changed_by: 3
      }]);
    } else if (order_code) {
      await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('order_code', order_code);
    }

    // 6. Cập nhật trạng thái xe sang ON_TRIP
    if (truckId) {
      await supabase
        .from('trucks')
        .update({ status: 'ON_TRIP' })
        .eq('id', truckId);
    }

    return res.status(201).json({
      message: 'Lập chuyến và phân bổ xe thành công!',
      trip: {
        id: tripCode,
        raw_id: tripId,
        plate: truck_plate || '29H-123.45',
        driver_name: driver_name || 'Nguyễn Văn Tài',
        status: 'IN_TRANSIT',
        waybill_no: waybillNo
      }
    });
  } catch (err) {
    console.error('createTrip exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật trạng thái chuyến xe (Hoàn thành chuyến / Đang đi)
const updateTripStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const realTripId = parseInt(id.replace('TRIP-', '')) || parseInt(id);

    let dbStatus = 'IN_PROGRESS';
    if (status === 'COMPLETED' || status === 'DELIVERED') dbStatus = 'COMPLETED';
    else if (status === 'CANCELLED') dbStatus = 'CANCELLED';

    // 1. Cập nhật chuyến
    const { data: updatedTrip, error } = await supabase
      .from('trips')
      .update({
        status: dbStatus,
        completed_at: dbStatus === 'COMPLETED' ? new Date().toISOString() : null
      })
      .or(`id.eq.${realTripId},trip_code.eq.${id}`)
      .select();

    if (error) {
      console.error('updateTripStatus error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật trạng thái chuyến', error });
    }

    // 2. Nếu chuyến hoàn thành: Trả xe về trạng thái AVAILABLE và cập nhật đơn hàng thành DELIVERED
    if (dbStatus === 'COMPLETED' && updatedTrip && updatedTrip.length > 0) {
      const trip = updatedTrip[0];
      if (trip.truck_id) {
        await supabase.from('trucks').update({ status: 'AVAILABLE' }).eq('id', trip.truck_id);
      }

      // Cập nhật trip_stops thành COMPLETED
      await supabase.from('trip_stops').update({ status: 'COMPLETED' }).eq('trip_id', trip.id);

      // Tìm các đơn hàng thuộc chuyến này qua trip_stop_orders
      const { data: stopOrders } = await supabase
        .from('trip_stop_orders')
        .select('order_id')
        .in('trip_stop_id', (await supabase.from('trip_stops').select('id').eq('trip_id', trip.id)).data?.map(s => s.id) || []);

      if (stopOrders && stopOrders.length > 0) {
        const orderIds = stopOrders.map(so => so.order_id);
        await supabase.from('orders').update({ 
          status: 'CLOSED', // Vận chuyển xong là đóng đơn luôn tự động
          delivered_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).in('id', orderIds);
      }
    }

    return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updatedTrip?.[0] });
  } catch (err) {
    console.error('updateTripStatus exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách sự cố
const getAllIncidents = async (req, res) => {
  try {
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select(`
        *,
        trip:trips!incidents_trip_id_fkey(id, trip_code, truck:trucks(plate_number), driver:driver_profiles!trips_driver_id_fkey(user:users(full_name, phone)))
      `)
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('getAllIncidents error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách sự cố', error });
    }

    const typeDisplayMap = {
      'BREAKDOWN': 'HỎNG XE GIỮA ĐƯỜNG',
      'ACCIDENT': 'VA CHẠM GIAO THÔNG',
      'CARGO_DAMAGED': 'HƯ HỎNG HÀNG HÓA',
      'CARGO_LOST': 'THẤT LẠC NIÊM PHONG',
      'HELD_BY_AUTHORITIES': 'KIỂM TRA HẢI QUAN / CSGT',
      'ROAD_BAN': 'CẤM ĐƯỜNG / KẸT XE',
      'FAILED_DELIVERY': 'GIAO HÀNG KHÔNG THÀNH CÔNG',
      'OTHER': 'SỰ CỐ KHÁC'
    };

    const formatted = (incidents || []).map(inc => ({
      id: `INC-${inc.id}`,
      raw_id: inc.id,
      trip_code: inc.trip?.trip_code || `TRIP-${inc.trip_id}`,
      truck: inc.trip?.truck?.plate_number || '29H-123.45',
      driver: inc.trip?.driver?.user?.full_name || 'Tài xế',
      phone: inc.trip?.driver?.user?.phone || '0901234567',
      type: typeDisplayMap[inc.type] || inc.type,
      raw_type: inc.type,
      severity: inc.type === 'ACCIDENT' || inc.type === 'BREAKDOWN' ? 'HIGH' : 'MEDIUM',
      status: inc.status === 'REPORTED' ? 'PENDING' : inc.status,
      reported_at: inc.reported_at ? new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:15',
      location: 'Km 18 cao tốc Nội Bài - Bắc Ninh',
      description: inc.description || 'Sự cố phát sinh trên đường vận chuyển'
    }));

    return res.json({ incidents: formatted });
  } catch (err) {
    console.error('getAllIncidents exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Báo cáo sự cố mới
const createIncident = async (req, res) => {
  try {
    const { trip_id, type, description, location } = req.body;

    let realTripId = parseInt(trip_id) || 1;
    if (typeof trip_id === 'string' && trip_id.includes('TRIP-')) {
      const { data: tr } = await supabase.from('trips').select('id').eq('trip_code', trip_id).limit(1);
      if (tr && tr.length > 0) realTripId = tr[0].id;
    }

    const { data: newInc, error } = await supabase
      .from('incidents')
      .insert([{
        trip_id: realTripId,
        reported_by: 3,
        type: type || 'BREAKDOWN',
        status: 'REPORTED',
        description: description || 'Sự cố phát sinh cần điều phối xử lý',
        reported_at: new Date().toISOString(),
        client_action_id: crypto.randomUUID()
      }])
      .select();

    if (error) {
      console.error('createIncident error:', error);
      return res.status(500).json({ message: 'Lỗi ghi nhận sự cố', error });
    }

    return res.status(201).json({ message: 'Đã báo cáo sự cố thành công', incident: newInc[0] });
  } catch (err) {
    console.error('createIncident exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cập nhật trạng thái sự cố (Giải quyết / Đóng)
const updateIncidentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const realId = parseInt(id.replace('INC-', '')) || parseInt(id);
    const { status, notes } = req.body;

    const { data: updated, error } = await supabase
      .from('incidents')
      .update({ status: status || 'RESOLVED' })
      .eq('id', realId)
      .select();

    if (error) {
      console.error('updateIncidentStatus error:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật sự cố', error });
    }

    return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated[0] });
  } catch (err) {
    console.error('updateIncidentStatus exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 5. DASHBOARD STATS (THỐNG KÊ TỔNG QUAN REALTIME)
// ==========================================

const getDispatcherDashboardStats = async (req, res) => {
  try {
    // 1. Thống kê số lượng đơn hàng theo trạng thái
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_code, status, agreed_price, customer_id, actual_weight_kg, chargeable_weight_kg, created_at, source, cancel_reason, cancel_fee, cancelled_at');

    const orderList = orders || [];
    const isCancelled = (o) => o.status === 'CANCELLED' || !!o.cancel_reason || !!o.cancelled_at;
    const nonCancelledOrders = orderList.filter(o => !isCancelled(o));

    const totalOrders = orderList.length;
    // Không tính giá cước của đơn hủy vào doanh thu (chỉ tính phí phạt hủy nếu có)
    const totalRevenue = orderList.reduce((sum, o) => {
      if (isCancelled(o)) {
        return sum + (Number(o.cancel_fee) || 0);
      }
      return sum + (Number(o.agreed_price) || 0);
    }, 0);

    const avgRevenue = nonCancelledOrders.length > 0 ? Math.round(totalRevenue / nonCancelledOrders.length) : 0;
    const totalWeight = nonCancelledOrders.reduce((sum, o) => sum + (Number(o.chargeable_weight_kg) || Number(o.actual_weight_kg) || 0), 0);
    const uniqueCustomers = new Set(nonCancelledOrders.map(o => o.customer_id).filter(Boolean)).size;

    const statusCounts = {
      DRAFT: orderList.filter(o => o.status === 'WAITING_FOR_DOCUMENTS' && o.agreed_price === 0).length,
      CONFIRMED: orderList.filter(o => o.status === 'WAITING_FOR_DOCUMENTS' && o.agreed_price > 0).length,
      READY_FOR_PLANNING: orderList.filter(o => o.status === 'READY_FOR_PLANNING').length,
      ASSIGNED: orderList.filter(o => o.status === 'ASSIGNED' || o.status === 'PLANNED').length,
      IN_TRANSIT: orderList.filter(o => o.status === 'IN_TRANSIT' || o.status === 'PICKED_UP').length,
      DELIVERED: orderList.filter(o => o.status === 'DELIVERED' || (o.status === 'CLOSED' && !o.cancel_reason)).length,
      CANCELLED: orderList.filter(o => o.status === 'CANCELLED' || (o.status === 'CLOSED' && !!o.cancel_reason)).length
    };

    // 2. Thống kê phương tiện
    const { data: trucks } = await supabase.from('trucks').select('status');
    const truckList = trucks || [];
    const fleetStats = {
      total: truckList.length,
      available: truckList.filter(t => t.status === 'AVAILABLE').length,
      on_trip: truckList.filter(t => t.status === 'ON_TRIP').length,
      maintenance: truckList.filter(t => t.status === 'MAINTENANCE').length
    };

    // 3. Thống kê chuyến xe
    const { data: trips } = await supabase.from('trips').select('status');
    const tripList = trips || [];
    const activeTripsCount = tripList.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length;

    // 4. Thống kê sự cố
    const { data: incidents } = await supabase.from('incidents').select('status');
    const incidentList = incidents || [];
    const pendingIncidentsCount = incidentList.filter(i => i.status === 'REPORTED').length;

    // 5. Thống kê doanh thu theo 12 tháng động từ dữ liệu đơn hàng thật (không tính đơn hủy)
    const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const monthlyOrders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    orderList.forEach(o => {
      if (o.created_at) {
        const d = new Date(o.created_at);
        const m = d.getMonth(); // 0 to 11
        if (!isCancelled(o)) {
          monthlyOrders[m] += 1;
          monthlyRevenue[m] += Math.round((Number(o.agreed_price) || 0) / 1000000);
        } else if (Number(o.cancel_fee) > 0) {
          monthlyRevenue[m] += Math.round((Number(o.cancel_fee) || 0) / 1000000);
        }
      }
    });

    return res.json({
      stats: {
        totalOrders,
        totalRevenue,
        avgRevenue,
        totalWeight,
        uniqueCustomers: uniqueCustomers || 8,
        deliveredCount: statusCounts.DELIVERED,
        inTransitCount: statusCounts.IN_TRANSIT + statusCounts.ASSIGNED,
        deliveredRate: totalOrders > 0 ? ((statusCounts.DELIVERED / totalOrders) * 100).toFixed(1) : '100.0',
        statusCounts,
        fleetStats,
        activeTripsCount,
        pendingIncidentsCount,
        monthlyRevenue,
        monthlyOrders
      }
    });
  } catch (err) {
    console.error('getDispatcherDashboardStats exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// 7. ROUTING PROXY (TÍNH TOÁN ĐƯỜNG BỘ THỰC TẾ QUA OSRM - LUÔN CHỌN ĐƯỜNG BỘ NGẮN NHẤT)
const calculateRoadRoute = async (req, res) => {
  try {
    const { startLng, startLat, endLng, endLat } = req.query;

    if (!startLng || !startLat || !endLng || !endLat) {
      return res.status(400).json({ message: 'Thiếu tham số tọa độ điểm đầu hoặc điểm cuối' });
    }

    const https = require('https');
    const geoapifyKey = process.env.GEOAPIFY_API_KEY || '5a7ccf56c9694e229e9621648227937a';

    const fetchJson = (url) => {
      return new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXLOG-Logistics'
          },
          timeout: 7000
        }, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (err) {
              reject(err);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
    };

    // 1. Ưu tiên Geoapify Routing API chuyên dụng (Đường bộ chính xác cao)
    try {
      const geoapifyUrl = `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLng}|${endLat},${endLng}&mode=drive&apiKey=${geoapifyKey}`;
      const geoData = await fetchJson(geoapifyUrl);
      const feature = geoData?.features?.[0];

      if (feature && feature.properties) {
        const distMeters = feature.properties.distance || 0;
        const timeSecs = feature.properties.time || 0;
        const geom = feature.geometry;

        // Geoapify MultiLineString [[ [lng, lat], ... ]] hoặc LineString [ [lng, lat], ... ]
        let coordsList = [];
        if (geom.type === 'MultiLineString') {
          coordsList = geom.coordinates.flat(1);
        } else if (geom.type === 'LineString') {
          coordsList = geom.coordinates;
        }

        if (coordsList.length > 0) {
          const polyline = coordsList.map(([lng, lat]) => [lat, lng]);
          return res.json({
            success: true,
            distanceKm: parseFloat((distMeters / 1000).toFixed(1)),
            durationMins: Math.max(5, Math.round(timeSecs / 60)),
            polyline
          });
        }
      }
    } catch (gErr) {
      console.warn('Geoapify Routing failed, fallback to OSM:', gErr.message);
    }

    // 2. Fallback: OpenStreetMap routed-car với alternatives=true
    const targetUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
    
    let osmData;
    try {
      osmData = await fetchJson(targetUrl);
    } catch {
      const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      osmData = await fetchJson(fallbackUrl).catch(() => null);
    }

    if (osmData && osmData.routes && osmData.routes.length > 0) {
      const sortedRoutes = [...osmData.routes].sort((a, b) => a.distance - b.distance);
      const shortestRoute = sortedRoutes[0];

      const distanceKm = parseFloat((shortestRoute.distance / 1000).toFixed(1));
      const durationMins = Math.max(5, Math.round(shortestRoute.duration / 60));
      const polyline = shortestRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      return res.json({
        success: true,
        distanceKm,
        durationMins,
        polyline
      });
    }

    return res.status(404).json({ message: 'Không tìm thấy đường bộ nối 2 điểm' });
  } catch (err) {
    console.error('calculateRoadRoute exception:', err);
    return res.status(500).json({ message: 'Lỗi tính toán tuyến đường' });
  }
};

module.exports = {
  // Fleet
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,
  // Locations
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  // Contracts
  getAllContracts,
  createContract,
  getAllCustomers,
  // Trips
  getAllTrips,
  createTrip,
  updateTripStatus,
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  // Dashboard
  getDispatcherDashboardStats,
  // Routing
  calculateRoadRoute
};
