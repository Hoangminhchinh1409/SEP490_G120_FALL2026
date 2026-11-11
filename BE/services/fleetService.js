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
  const now = new Date();

  return (trucks || []).map((t) => {
    const payload = t.allowed_payload || t.payload_kg || 1250;
    const length = t.box_length_cm || t.box_length;
    const width = t.box_width_cm || t.box_width;
    const height = t.box_height_cm || t.box_height;
    let volM3;
    if (length && width && height) {
      const rawVol = length * width * height;
      volM3 = rawVol > 1000 ? parseFloat((rawVol / 1000000).toFixed(1)): parseFloat(rawVol.toFixed(1));
    } else {
      volM3 = parseFloat(((payload * 0.0068) || 9.5).toFixed(1));
    }

    // 1. Phân loại hạn đăng kiểm đa tầng theo Thông tư 02/2023/TT-BGTVT
    const inspectionDate = t.inspection_expiry ? new Date(t.inspection_expiry): new Date(now.getTime() + 60 * 86400000);
    const daysUntilInspection = Math.ceil((inspectionDate - now) / (1000 * 60 * 60 * 24));
    let inspectionAlertLevel = 'SAFE'; // > 30 ngày (An toàn)
    if (daysUntilInspection <= 0) {
      inspectionAlertLevel = 'EXPIRED'; // Đã hết hạn (Khóa xe)
    } else if (daysUntilInspection <= 14) {
      inspectionAlertLevel = 'URGENT'; // Dưới 14 ngày (Nguy cấp)
    } else if (daysUntilInspection <= 30) {
      inspectionAlertLevel = 'WARNING'; // 15 - 30 ngày (Sắp đến hạn)
    }

    // 2. Quản lý chu kỳ bảo dưỡng định kỳ (Dual-trigger ODO & Thời gian - 5.000 km / cấp 1)
    const currentOdo = t.current_odometer_km || (24500 + (t.id * 8320) % 75000);
    const lastMaintenanceKm = Math.floor(currentOdo / 5000) * 5000;
    const nextMaintenanceKm = lastMaintenanceKm + 5000;
    const kmUntilMaintenance = nextMaintenanceKm - currentOdo;
    const maintenanceIntervalKm = 5000;
    const kmTraveledInCycle = currentOdo - lastMaintenanceKm;
    const maintenanceProgressPct = Math.min(Math.round((kmTraveledInCycle / maintenanceIntervalKm) * 100), 100);

    let maintenanceStatus = 'GOOD';
    if (kmUntilMaintenance <= 0) {
      maintenanceStatus = 'OVERDUE';
    } else if (kmUntilMaintenance <= 500) {
      maintenanceStatus = 'DUE_SOON';
    }

    // 3. Quản lý thời gian sửa chữa & Downtime gián đoạn hoạt động
    const isMaintenance = t.status === 'MAINTENANCE';
    const downtimeHours = isMaintenance ? (12 + (t.id * 7) % 36): 0;
    const garageName = isMaintenance ? 'Xưởng Dịch vụ Ô tô Tải Thaco Long Biên': 'Gara Kỹ thuật NEXLOG Depot';

    return {
      key: t.id.toString(),
      id: t.id,
      plate: t.plate_number,
      plate_number: t.plate_number,
      model: t.model || getTruckModelName(payload),
      category: getTruckCategory(payload),
      payload_kg: payload,
      allowed_payload: payload,
      volume_m3: volM3,
      box_length_cm: t.box_length_cm,
      box_width_cm: t.box_width_cm,
      box_height_cm: t.box_height_cm,
      cargo_type: payload > 10000 ? 'Moóc xương Container': 'Thùng kín inox',
      equipment: 'Kẹp chì niêm phong, GPS, Cảm biến hành trình',
      assigned_driver: 'Nguyễn Văn Tài',
      driver_phone: '0901234567',
      location: 'Depot Cảng HKQT Nội Bài',
      registration_exp: t.inspection_expiry || '2027-05-15',
      inspection_expiry: t.inspection_expiry,
      insurance_exp: t.insurance_expiry || '2027-06-01',
      insurance_expiry: t.insurance_expiry,
      status: t.status || 'AVAILABLE',
      license_class_required: t.license_class_required || 'B2',
      required_license_class: t.license_class_required || 'B2',
      // Chỉ số Đăng kiểm & Pháp lý
      days_until_inspection: daysUntilInspection,
      inspection_alert_level: inspectionAlertLevel,
      is_inspection_expired: daysUntilInspection <= 0,
      // Chỉ số Bảo dưỡng định kỳ
      current_odometer_km: currentOdo,
      last_maintenance_km: lastMaintenanceKm,
      next_maintenance_km: nextMaintenanceKm,
      km_until_maintenance: kmUntilMaintenance,
      maintenance_progress_pct: maintenanceProgressPct,
      maintenance_status: maintenanceStatus,
      // Chỉ số Sửa chữa & Downtime
      downtime_hours: downtimeHours,
      service_garage: garageName
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
      id_card: u.username?.includes('driver_') ? `0385722${d.id}9`: (u.username || '0385722949'),
      license_type: `Hạng ${d.license_class || 'C'}`,
      license_class: d.license_class || 'C',
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      experience_years: `${3 + d.id * 2} năm kinh nghiệm`,
      shift_hours_today: index === 0 ? 3.5: 2.0,
      max_shift_hours: 8.0,
      assigned_truck: index === 0 ? '29H-123.45': '29H-543.21',
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
    status: v.approval_status === 'APPROVED' ? 'APPROVED': 'PENDING',
    rating: 4.8
  }));
};


// ==========================================
// DRIVER SHIFTS
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
      registered_by: s.registered_by,
      created_by: s.created_by,
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
    throw new Error('Lỗi: Tài xế này đã có ca làm việc khác chồng lấn thời gian trong ngày này.');
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
    warningMessage = `Cảnh báo: Ca làm việc đã lưu nhưng tổng giờ làm việc trong ngày của tài xế đạt ${totalDailyHours}h, vượt quá 10 giờ/ngày.`;
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
    throw new Error('Lỗi: Thời gian mới bị chồng lấn với ca làm việc khác của tài xế.');
  }

  const updated = await driverModel.updateDriverShift(id, {
    date: targetDate,
    start_time: isoStart,
    end_time: isoEnd,
    note: note !== undefined ? note: existing.note,
    reviewed_by: reviewerId || existing.reviewed_by
  });

  let warningMessage = null;
  const totalDailyHours = await driverModel.calculateDriverDailyHours(existing.driver_id, targetDate);
  if (totalDailyHours > 10) {
    warningMessage = `Cảnh báo: Tổng giờ làm việc trong ngày của tài xế đạt ${totalDailyHours}h, vượt quá 10 giờ/ngày.`;
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
    warningMessage = `Cảnh báo: Tổng giờ làm việc trong ngày ${existing.date} của tài xế đạt ${totalDailyHours}h, vượt quá giới hạn an toàn 10 giờ/ngày.`;
  }

  const driverProfile = existing.driver_profiles;
  if (driverProfile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: existing.id,
      message: `Ca làm việc ngày ${existing.date} của bạn đã được Quản lý phê duyệt.`
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

const addDaysStrGMT7 = (dateStr, days) => {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
};

const getGMT7WeekScheduleContext = () => {
  const gmt7 = new Date(Date.now() + 7 * 3600 * 1000);
  const todayStr = gmt7.toISOString().split('T')[0];
  const dayOfWeek = gmt7.getUTCDay(); // 0 = Chu Nhat
  const hour = gmt7.getUTCHours();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = addDaysStrGMT7(todayStr, diffToMon);
  const nextMonday = addDaysStrGMT7(currentMonday, 7);
  const nextSunday = addDaysStrGMT7(nextMonday, 6);
  return { todayStr, dayOfWeek, hour, currentMonday, nextMonday, nextSunday };
};

const sendShiftDeadlineReminders = async ({ force = false } = {}) => {
  const { dayOfWeek, hour, nextMonday, nextSunday } = getGMT7WeekScheduleContext();

  if (!force) {
    const dailyFlag = await driverModel.getSystemSettingValue('shift_auto_assign_daily_22h');
    const isDailyMode = String(dailyFlag || '').toLowerCase() === 'true';
    // Gửi nhắc nhở đúng khung 21:00 - 21:59 ngày Chủ Nhật (hoặc 21h hàng ngày nếu bật cờ test)
    const inReminderWindow = (isDailyMode || dayOfWeek === 0) && hour >= 21 && hour < 22;
    if (!inReminderWindow) {
      return { sentCount: 0, skipped: true, nextMonday, nextSunday };
    }
  }

  const [activeDrivers, nextWeekShifts] = await Promise.all([
    driverModel.getAllActiveDriverProfiles(),
    driverModel.getAllShiftsBetweenDates(nextMonday, nextSunday),
  ]);

  const scheduledDriverIds = new Set((nextWeekShifts || []).map((sh) => Number(sh.driver_id)));
  const reminderTag = `[NHẮC ĐĂNG KÝ CA - Tuần ${nextMonday}]`;
  let sentCount = 0;

  for (const drv of activeDrivers || []) {
    if (scheduledDriverIds.has(Number(drv.id)) || !drv.user_account_id) continue;
    const alreadySent = await driverModel.hasNotificationWithText(drv.user_account_id, reminderTag);
    if (alreadySent) continue;

    await driverModel.createSystemNotification({
      userAccountId: drv.user_account_id,
      targetType: 'SHIFT',
      targetId: null,
      message: `${reminderTag} Hiện đã 21:00 Chủ Nhật, bạn chưa đăng ký lịch làm tuần tới (${nextMonday} đến ${nextSunday}). Vui lòng đăng ký trước 22:00 hôm nay; sau 22:00 hệ thống sẽ tự động xếp lịch cố định (Ca Sáng hoặc Ca Đêm) và không thể tự sửa đổi.`,
    });
    sentCount++;
  }

  return {
    sentCount,
    nextMonday,
    nextSunday,
    message: sentCount > 0
      ? `Đã gửi thông báo nhắc đăng ký ca 21h cho ${sentCount} tài xế chưa có lịch tuần tới.`
      : 'Không có tài xế nào cần nhắc nhở thêm cho tuần tới.',
  };
};

const autoAssignNextWeekShifts = async ({ force = false, triggeredBy = null } = {}) => {
  const { dayOfWeek, hour, nextMonday, nextSunday } = getGMT7WeekScheduleContext();

  if (!force) {
    const dailyFlag = await driverModel.getSystemSettingValue('shift_auto_assign_daily_22h');
    const isDailyMode = String(dailyFlag || '').toLowerCase() === 'true';
    const isPastDeadline = (isDailyMode && hour >= 22) || (dayOfWeek === 0 && hour >= 22);
    if (!isPastDeadline) {
      return { executed: false, skippedReason: 'NOT_DUE', nextMonday, nextSunday };
    }
  }

  const [activeDrivers, nextWeekShifts] = await Promise.all([
    driverModel.getAllActiveDriverProfiles(),
    driverModel.getAllShiftsBetweenDates(nextMonday, nextSunday),
  ]);

  const driverShiftMap = new Map();
  let morningDriverCount = 0;
  let nightDriverCount = 0;

  for (const sh of nextWeekShifts || []) {
    const dId = Number(sh.driver_id);
    if (!driverShiftMap.has(dId)) {
      driverShiftMap.set(dId, true);
      const startH = sh.start_time ? new Date(new Date(sh.start_time).getTime() + 7 * 3600 * 1000).getUTCHours() : 8;
      if (startH >= 15) nightDriverCount++;
      else morningDriverCount++;
    }
  }

  const unscheduledDrivers = (activeDrivers || []).filter((drv) => !driverShiftMap.has(Number(drv.id)));
  if (unscheduledDrivers.length === 0) {
    return {
      executed: true,
      nextMonday,
      nextSunday,
      assignedDriversCount: 0,
      assignedMorning: 0,
      assignedNight: 0,
      totalShiftsCreated: 0,
      message: 'Tất cả tài xế đang hoạt động đều đã có lịch cho tuần tới.',
    };
  }

  let assignedMorning = 0;
  let assignedNight = 0;
  let totalShiftsCreated = 0;
  const details = [];

  for (const drv of unscheduledDrivers) {
    const shiftType = morningDriverCount <= nightDriverCount ? 'MORNING' : 'NIGHT';
    if (shiftType === 'MORNING') {
      morningDriverCount++;
      assignedMorning++;
    } else {
      nightDriverCount++;
      assignedNight++;
    }

    const shiftLabel = shiftType === 'MORNING' ? 'Ca Sáng (08:00 - 17:00)' : 'Ca Đêm (17:00 - 08:00 hôm sau)';
    const rows = [];
    let cur = nextMonday;
    while (cur <= nextSunday) {
      const startIso = shiftType === 'MORNING' ? `${cur}T08:00:00+07:00` : `${cur}T17:00:00+07:00`;
      const endDate = shiftType === 'MORNING' ? cur : addDaysStrGMT7(cur, 1);
      const endIso = shiftType === 'MORNING' ? `${endDate}T17:00:00+07:00` : `${endDate}T08:00:00+07:00`;
      rows.push({
        driver_id: drv.id,
        date: cur,
        start_time: startIso,
        end_time: endIso,
        // Đưa vào hàng chờ Quản lý duyệt & cân đối lại nếu bị lệch (tài xế vẫn bị khóa nhờ marker [Hệ thống tự động xếp lịch])
        status: 'Requested',
        registered_by: null,
        created_by: triggeredBy || null,
        reviewed_by: null,
        reviewed_at: null,
        note: `[Hệ thống tự động xếp lịch] ${shiftLabel} (${nextMonday} đến ${nextSunday}) - Chờ Quản lý duyệt`,
      });
      cur = addDaysStrGMT7(cur, 1);
    }

    const inserted = await driverModel.bulkInsertDriverShifts(rows);
    totalShiftsCreated += inserted.length;

    if (drv.user_account_id) {
      await driverModel.createSystemNotification({
        userAccountId: drv.user_account_id,
        targetType: 'SHIFT',
        targetId: inserted[0]?.id || null,
        message: `Hệ thống đã tự động xếp lịch tuần tới (${nextMonday} đến ${nextSunday}) cho bạn: ${shiftLabel} (đang chờ Quản lý phê duyệt/cân đối). Bạn không thể tự sửa đổi lịch này.`,
      });
    }

    details.push({
      driver_id: drv.id,
      driver_name: drv.users?.full_name || `Driver #${drv.id}`,
      shift_type: shiftType,
      days_count: inserted.length,
    });
  }

  return {
    executed: true,
    nextMonday,
    nextSunday,
    assignedDriversCount: details.length,
    assignedMorning,
    assignedNight,
    totalShiftsCreated,
    details,
    message: `Đã tự động xếp lịch tuần tới (${nextMonday} - ${nextSunday}) cho ${details.length} tài xế chưa đăng ký (đang chờ Quản lý duyệt/cân đối).`,
  };
};

const approveDriverWeekShifts = async ({ driverId, weekStart, reviewerId }) => {
  if (!driverId || !weekStart) {
    const err = new Error('Thiếu driverId hoặc ngày đầu tuần (weekStart).');
    err.statusCode = 400;
    throw err;
  }
  const { weekStart: mon, weekEnd: sun } = driverModel.getWeekMondaySundayFromDateStr(String(weekStart).split('T')[0]);
  const updated = await driverModel.bulkApproveDriverShiftsInRange(Number(driverId), mon, sun, reviewerId);
  if (!updated || updated.length === 0) {
    const err = new Error('Không có ca làm việc nào đang chờ duyệt trong tuần này cho tài xế.');
    err.statusCode = 400;
    throw err;
  }

  const profile = await driverModel.getDriverProfileById(Number(driverId));
  if (profile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: profile.user_account_id,
      targetType: 'SHIFT',
      targetId: updated[0]?.id || null,
      message: `Lịch làm việc cả tuần (${mon} đến ${sun}) của bạn đã được Quản lý phê duyệt cố định.`,
    });
  }

  return {
    approvedCount: updated.length,
    weekStart: mon,
    weekEnd: sun,
    shifts: updated,
    message: `Đã phê duyệt trọn tuần (${mon} - ${sun}, ${updated.length} ngày).`,
  };
};

const switchDriverWeekShiftType = async ({ driverId, weekStart, shiftType, reviewerId, autoApprove = false }) => {
  const normalizedType = String(shiftType || '').trim().toUpperCase();
  if (!driverId || !weekStart || !['MORNING', 'NIGHT'].includes(normalizedType)) {
    const err = new Error('Thiếu thông tin hợp lệ (driverId, weekStart, shiftType: MORNING | NIGHT).');
    err.statusCode = 400;
    throw err;
  }

  const { weekStart: mon, weekEnd: sun } = driverModel.getWeekMondaySundayFromDateStr(String(weekStart).split('T')[0]);
  const shiftLabel = normalizedType === 'MORNING' ? 'Ca Sáng (08:00 - 17:00)' : 'Ca Đêm (17:00 - 08:00 hôm sau)';
  const existingShifts = await driverModel.getShiftsInRange(Number(driverId), mon, sun);

  let updatedList = [];
  if (!existingShifts || existingShifts.length === 0) {
    const rows = [];
    let cur = mon;
    const nowIso = new Date().toISOString();
    while (cur <= sun) {
      const startIso = normalizedType === 'MORNING' ? `${cur}T08:00:00+07:00` : `${cur}T17:00:00+07:00`;
      const endDate = normalizedType === 'MORNING' ? cur : addDaysStrGMT7(cur, 1);
      const endIso = normalizedType === 'MORNING' ? `${endDate}T17:00:00+07:00` : `${endDate}T08:00:00+07:00`;
      rows.push({
        driver_id: Number(driverId),
        date: cur,
        start_time: startIso,
        end_time: endIso,
        status: 'Approved',
        registered_by: reviewerId,
        created_by: reviewerId,
        reviewed_by: reviewerId,
        reviewed_at: nowIso,
        note: `[Quản lý sắp xếp] ${shiftLabel} (${mon} đến ${sun})`,
      });
      cur = addDaysStrGMT7(cur, 1);
    }
    updatedList = await driverModel.bulkInsertDriverShifts(rows);
  } else {
    const nowIso = new Date().toISOString();
    for (const sh of existingShifts) {
      const dStr = sh.date;
      const startIso = normalizedType === 'MORNING' ? `${dStr}T08:00:00+07:00` : `${dStr}T17:00:00+07:00`;
      const endDate = normalizedType === 'MORNING' ? dStr : addDaysStrGMT7(dStr, 1);
      const endIso = normalizedType === 'MORNING' ? `${endDate}T17:00:00+07:00` : `${endDate}T08:00:00+07:00`;
      const wasAuto = (sh.note && sh.note.includes('[Hệ thống tự động xếp lịch]')) || sh.registered_by === null;
      const prefix = wasAuto ? '[Hệ thống tự động xếp lịch] ' : '';
      const newNote = `${prefix}[Quản lý điều chỉnh sang ${shiftLabel}] (${mon} đến ${sun})`;
      const fields = {
        start_time: startIso,
        end_time: endIso,
        note: newNote,
        reviewed_by: reviewerId,
      };
      if (autoApprove && sh.status === 'Requested') {
        fields.status = 'Approved';
        fields.reviewed_at = nowIso;
      }
      const upd = await driverModel.updateDriverShift(sh.id, fields);
      if (upd) updatedList.push(upd);
    }
  }

  const profile = await driverModel.getDriverProfileById(Number(driverId));
  if (profile?.user_account_id) {
    await driverModel.createSystemNotification({
      userAccountId: profile.user_account_id,
      targetType: 'SHIFT',
      targetId: updatedList[0]?.id || null,
      message: `Quản lý đã điều chỉnh lịch làm việc tuần (${mon} đến ${sun}) của bạn sang ${shiftLabel}.`,
    });
  }

  return {
    updatedCount: updatedList.length,
    weekStart: mon,
    weekEnd: sun,
    shiftType: normalizedType,
    shiftLabel,
    shifts: updatedList,
    message: `Đã chuyển cả tuần (${mon} - ${sun}) sang ${shiftLabel} (${updatedList.length} ngày).`,
  };
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
  deleteShift,
  autoAssignNextWeekShifts,
  sendShiftDeadlineReminders,
  approveDriverWeekShifts,
  switchDriverWeekShiftType,
};

