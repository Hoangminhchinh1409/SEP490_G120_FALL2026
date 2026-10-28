const fleetModel = require('../models/fleetModel');

const getTruckModelName = (payloadKg) => {
  const p = Number(payloadKg) || 1250;
  if (p <= 1500) return 'Thaco Frontier 1.25T';
  if (p <= 2500) return 'Thaco Ollin 2.5T';
  if (p <= 5000) return 'Thaco Auman 4.0T';
  if (p <= 8000) return 'Hino 500 Series 8T';
  return 'Đầu kéo Container Dongfeng';
};

const getTruckCategory = (payloadKg) => {
  const p = Number(payloadKg) || 1250;
  if (p <= 1500) return 'Xe tải nhẹ';
  if (p <= 3500) return 'Xe tải trung';
  if (p <= 10000) return 'Xe tải nặng';
  return 'Xe đầu kéo';
};

const getAllTrucks = async () => {
  const trucks = await fleetModel.findAllTrucks();
  return (trucks || []).map(t => {
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
};

const createTruck = async (payload) => {
  if (!payload.plate_number) {
    throw new Error('Biển số xe là bắt buộc');
  }

  const truckData = {
    plate_number: payload.plate_number.trim(),
    payload_kg: parseInt(payload.payload_kg, 10) || 1250,
    box_length_cm: parseInt(payload.box_length_cm, 10) || 310,
    box_width_cm: parseInt(payload.box_width_cm, 10) || 160,
    box_height_cm: parseInt(payload.box_height_cm, 10) || 170,
    license_class_required: payload.license_class_required || 'B2',
    inspection_expiry: payload.inspection_expiry || '2027-12-31',
    insurance_expiry: payload.insurance_expiry || '2027-12-31',
    status: 'AVAILABLE'
  };

  return await fleetModel.createTruck(truckData);
};

const updateTruck = async (id, payload) => {
  const updateData = {};
  if (payload.status) updateData.status = payload.status;
  if (payload.payload_kg) updateData.payload_kg = parseInt(payload.payload_kg, 10);
  if (payload.inspection_expiry) updateData.inspection_expiry = payload.inspection_expiry;
  if (payload.insurance_expiry) updateData.insurance_expiry = payload.insurance_expiry;

  return await fleetModel.updateTruck(id, updateData);
};

const getAllDrivers = async () => {
  const profiles = await fleetModel.findAllDrivers();
  return (profiles || []).map((d, index) => {
    const u = d.user || {};
    const statusMap = {
      Active: 'AVAILABLE',
      ACTIVE: 'AVAILABLE',
      ON_TRIP: 'ON_DUTY',
      RESTING: 'RESTING',
      INACTIVE: 'RESTING'
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
};

const updateDriver = async (id, payload) => {
  const updateData = {};
  if (payload.status) updateData.status = payload.status;
  if (payload.license_class) updateData.license_class = payload.license_class;
  if (payload.license_expiry) updateData.license_expiry = payload.license_expiry;

  return await fleetModel.updateDriver(id, updateData);
};

const getAllVendors = async () => {
  const vendors = await fleetModel.findAllVendors();
  return (vendors || []).map(v => ({
    id: v.id.toString(),
    key: v.id.toString(),
    name: v.company_name,
    contact_person: v.contact_person,
    phone: v.phone,
    truck_types: v.truck_types,
    status: v.approval_status === 'APPROVED' ? 'APPROVED' : 'PENDING',
    rating: 4.8
  }));
};

module.exports = {
  getTruckModelName,
  getTruckCategory,
  getAllTrucks,
  createTruck,
  updateTruck,
  getAllDrivers,
  updateDriver,
  getAllVendors
};

