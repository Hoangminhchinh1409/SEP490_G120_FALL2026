const supabase = require('../../config/supabase');

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
        user_account_id,
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
        'Active': 'AVAILABLE',
        'ACTIVE': 'AVAILABLE',
        'ON_TRIP': 'ON_DUTY',
        'RESTING': 'RESTING',
        'INACTIVE': 'RESTING'
      };

      return {
        key: `D${d.id}`,
        id: d.id,
        user_id: d.user_account_id,
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


module.exports = {
  getTruckModelName,
  getTruckCategory,
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors
};