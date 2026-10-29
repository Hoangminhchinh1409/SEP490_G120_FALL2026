const driverModel = require('../models/driverModel');
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


// ==========================================
// DRIVER SHIFTS (UC-20, Screen 25, BR-08, BR-34, BR-60)
// ==========================================

const getShifts = async ({ from, to, status, driver_id }) => {
  const data = await driverModel.getShiftsWithDriverInfo({ from, to, status, driverId: driver_id });
  return (data || []).map((s) => {
    const dp = s.driver_profiles;
    const u = dp?.users;

    let durationHours = 0;
    try {
      const st = new Date(s.start_time);
      const et = new Date(s.end_time);
      durationHours = Math.max(0, Number(((et - st) / (1000 * 60 * 60)).toFixed(1)));
    } catch {
      durationHours = 8;
    }

    return {
      id: s.id,
      driver_id: s.driver_id,
      driver_name: u?.full_name || u?.username || `Tài xế #${s.driver_id}`,
      driver_phone: u?.phone || '',
      driver_username: u?.username || '',
      license_class: dp?.license_class || '',
      license_number: dp?.license_number || '',
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_hours: durationHours,
      status: s.status,
      note: s.note,
      rejection_reason: s.rejection_reason,
      reviewed_at: s.reviewed_at,
      created_at: s.created_at
    };
  });
};

const createShift = async ({ driver_id, date, start_time, end_time, note, creatorId }) => {
  if (!driver_id || !date || !start_time || !end_time) {
    throw new Error('Tài xế, ngày và khoảng thời gian bắt đầu - kết thúc là bắt buộc');
  }

  let isoStart = start_time;
  let isoEnd = end_time;
  if (!start_time.includes('T')) {
    isoStart = `${date}T${start_time}:00+07:00`;
  }
  if (!end_time.includes('T')) {
    isoEnd = `${date}T${end_time}:00+07:00`;
  }

  const hasOverlap = await driverModel.checkShiftOverlap(driver_id, date, isoStart, isoEnd);
  if (hasOverlap) {
    throw new Error('Lỗi BR-08: Tài xế này đã có ca làm việc khác chồng lấn thời gian trong ngày này.');
  }

  const newShift = await driverModel.insertShiftRecord({
    driver_id,
    date,
    start_time: isoStart,
    end_time: isoEnd,
    note: note || 'Ca trực do Quản lý tạo',
    status: 'Approved',
    created_by: creatorId,
    registered_by: creatorId,
    reviewed_by: creatorId,
    reviewed_at: new Date().toISOString()
  });

  let warningMessage = null;
  const totalDailyHours = await driverModel.calculateDriverDailyHours(driver_id, date);
  if (totalDailyHours > 10) {
    warningMessage = `Cảnh báo BR-34: Ca làm việc đã lưu nhưng tổng giờ làm việc trong ngày của tài xế đạt ${totalDailyHours}h, vượt quá 10 giờ/ngày.`;
  }

  const driverProfile = newShift?.driver_profiles;
  if (driverProfile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: newShift.id,
      message: `Quản lý đã xếp ca làm việc cho bạn vào ngày ${date}.`
    });
  }

  return { shift: newShift, warning: warningMessage };
};

const updateShift = async (id, { date, start_time, end_time, note, reviewerId }) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw new Error('Không tìm thấy ca làm việc');
  }

  const targetDate = date || existing.date;
  let isoStart = start_time || existing.start_time;
  let isoEnd = end_time || existing.end_time;
  if (!isoStart.includes('T')) {
    isoStart = `${targetDate}T${isoStart}:00+07:00`;
  }
  if (!isoEnd.includes('T')) {
    isoEnd = `${targetDate}T${isoEnd}:00+07:00`;
  }

  const hasOverlap = await driverModel.checkShiftOverlap(existing.driver_id, targetDate, isoStart, isoEnd, id);
  if (hasOverlap) {
    throw new Error('Lỗi BR-08: Thời gian mới bị chồng lấn với ca làm việc khác của tài xế.');
  }

  const updated = await driverModel.updateDriverShift(id, {
    date: targetDate,
    start_time: isoStart,
    end_time: isoEnd,
    note: note !== undefined ? note : existing.note,
    reviewed_by: reviewerId || existing.reviewed_by
  });

  let warningMessage = null;
  const totalDailyHours = await driverModel.calculateDriverDailyHours(existing.driver_id, targetDate);
  if (totalDailyHours > 10) {
    warningMessage = `Cảnh báo BR-34: Tổng giờ làm việc trong ngày của tài xế đạt ${totalDailyHours}h, vượt quá 10 giờ/ngày.`;
  }

  return { shift: updated, warning: warningMessage };
};

const approveShift = async (id, reviewerId) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw new Error('Không tìm thấy ca làm việc');
  }

  const updated = await driverModel.updateDriverShift(id, {
    status: 'Approved',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  });

  let warningMessage = null;
  const totalDailyHours = await driverModel.calculateDriverDailyHours(existing.driver_id, existing.date);
  if (totalDailyHours > 10) {
    warningMessage = `Cảnh báo BR-34: Tổng giờ làm việc trong ngày ${existing.date} của tài xế đạt ${totalDailyHours}h, vượt quá giới hạn an toàn 10 giờ/ngày.`;
  }

  const driverProfile = existing.driver_profiles;
  if (driverProfile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: existing.id,
      message: `Ca làm việc ngày ${existing.date} của bạn đã được Quản lý phê duyệt (MSG80).`
    });
  }

  return { shift: updated, warning: warningMessage };
};

const rejectShift = async (id, reason, reviewerId) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw new Error('Không tìm thấy ca làm việc');
  }

  const rejectionReason = reason || 'Quản lý không phê duyệt ca này';
  const updated = await driverModel.updateDriverShift(id, {
    status: 'Rejected',
    rejection_reason: rejectionReason,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  });

  const driverProfile = existing.driver_profiles;
  if (driverProfile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: existing.id,
      message: `Ca làm việc ngày ${existing.date} đã bị từ chối. Lý do: ${rejectionReason}`
    });
  }

  return { shift: updated };
};

const deleteShift = async (id) => {
  return await driverModel.deleteDriverShift(id);
};

module.exports = {
  getTruckModelName,
  getTruckCategory,
  getAllTrucks,
  createTruck,
  updateTruck,
  getAllDrivers,
  updateDriver,
  getAllVendors,
  getShifts,
  createShift,
  updateShift,
  approveShift,
  rejectShift,
  deleteShift
};

