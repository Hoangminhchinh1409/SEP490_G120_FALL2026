const driverModel = require('../models/driverModel');
const fleetModel = require('../models/fleetModel');
const leaveModel = require('../models/leaveModel');

const getTruckModelName = (payloadKg) => {
  const p = Number(payloadKg) || 1250;
  if (p <= 1500) return 'Thaco Frontier 1.25T';
  if (p <= 2500) return 'Thaco Ollin 2.5T';
  if (p <= 3500) return 'Thaco Ollin 3.5T';
  if (p <= 5000) return 'Thaco Auman 5.0T';
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
    const rawPayload = t.allowed_payload !== undefined && t.allowed_payload !== null
      ? Number(t.allowed_payload)
      : (t.payload_kg !== undefined && t.payload_kg !== null ? Number(t.payload_kg) : null);
    const length = t.box_length_cm ?? t.box_length ?? null;
    const width = t.box_width_cm ?? t.box_width ?? null;
    const height = t.box_height_cm ?? t.box_height ?? null;
    let volM3 = null;
    if (length && width && height) {
      const rawVol = Number(length) * Number(width) * Number(height);
      volM3 = rawVol > 1000 ? parseFloat((rawVol / 1000000).toFixed(1)) : parseFloat(rawVol.toFixed(1));
    }

    // 1. Phân loại hạn đăng kiểm đa tầng theo Thông tư 02/2023/TT-BGTVT
    let daysUntilInspection = null;
    let inspectionAlertLevel = 'UNKNOWN';
    if (t.inspection_expiry) {
      const inspectionDate = new Date(t.inspection_expiry);
      daysUntilInspection = Math.ceil((inspectionDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntilInspection <= 0) {
        inspectionAlertLevel = 'EXPIRED'; // Đã hết hạn (Khóa xe)
      } else if (daysUntilInspection <= 14) {
        inspectionAlertLevel = 'URGENT'; // Dưới 14 ngày (Nguy cấp)
      } else if (daysUntilInspection <= 30) {
        inspectionAlertLevel = 'WARNING'; // 15 - 30 ngày (Sắp đến hạn)
      } else {
        inspectionAlertLevel = 'SAFE'; // > 30 ngày (An toàn)
      }
    }

    // 2. Quản lý chu kỳ bảo dưỡng định kỳ (Dual-trigger ODO & Thời gian - 5.000 km / cấp 1)
    let currentOdo = null;
    let lastMaintenanceKm = null;
    let nextMaintenanceKm = null;
    let kmUntilMaintenance = null;
    let maintenanceProgressPct = null;
    let maintenanceStatus = 'UNKNOWN';

    if (t.current_odometer_km !== undefined && t.current_odometer_km !== null) {
      currentOdo = Number(t.current_odometer_km);
      lastMaintenanceKm = Math.floor(currentOdo / 5000) * 5000;
      nextMaintenanceKm = lastMaintenanceKm + 5000;
      kmUntilMaintenance = nextMaintenanceKm - currentOdo;
      maintenanceProgressPct = Math.min(Math.round(((currentOdo - lastMaintenanceKm) / 5000) * 100), 100);

      // Nếu odo đạt đúng mốc bảo dưỡng (ví dụ 15,000 km) hoặc vượt quá
      if (currentOdo % 5000 === 0 || kmUntilMaintenance <= 0) {
        maintenanceStatus = 'OVERDUE';
      } else if (kmUntilMaintenance <= 500) {
        maintenanceStatus = 'DUE_SOON';
      } else {
        maintenanceStatus = 'GOOD';
      }
    }

    // 3. Quản lý thời gian sửa chữa & Downtime gián đoạn hoạt động
    const rawStatus = String(t.status || 'AVAILABLE').toUpperCase();
    const isMaintenance = rawStatus === 'MAINTENANCE';
    const downtimeHours = isMaintenance ? (t.downtime_hours !== undefined && t.downtime_hours !== null ? Number(t.downtime_hours) : null) : 0;
    const garageName = isMaintenance ? (t.service_garage || null) : null;

    return {
      key: t.id.toString(),
      id: t.id,
      plate: t.plate_number,
      plate_number: t.plate_number,
      model: t.model || null,
      category: rawPayload !== null ? getTruckCategory(rawPayload) : null,
      payload_kg: rawPayload,
      allowed_payload: rawPayload,
      volume_m3: volM3,
      box_length_cm: t.box_length_cm ?? t.box_length ?? null,
      box_width_cm: t.box_width_cm ?? t.box_width ?? null,
      box_height_cm: t.box_height_cm ?? t.box_height ?? null,
      cargo_type: rawPayload !== null ? (rawPayload > 10000 ? 'Moóc xương Container' : 'Thùng kín inox') : null,
      equipment: t.gps_device_id ? 'GPS' : null,
      assigned_driver: t.assigned_driver || null,
      driver_phone: t.driver_phone || null,
      location: t.location || null,
      registration_exp: t.inspection_expiry || null,
      inspection_expiry: t.inspection_expiry || null,
      insurance_exp: t.insurance_expiry || null,
      insurance_expiry: t.insurance_expiry || null,
      status: rawStatus,
      license_class_required: t.license_class_required || t.required_license_class || null,
      required_license_class: t.license_class_required || t.required_license_class || null,
      // Chỉ số Đăng kiểm & Pháp lý
      days_until_inspection: daysUntilInspection,
      inspection_alert_level: inspectionAlertLevel,
      is_inspection_expired: daysUntilInspection !== null ? daysUntilInspection <= 0 : false,
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
  return (profiles || []).map((d) => {
    const u = d.user || {};
    const rawSt = String(d.status || '').toUpperCase();
    let status = 'AVAILABLE';
    if (rawSt === 'ACTIVE') status = 'AVAILABLE';
    else if (rawSt === 'ON_TRIP' || rawSt === 'ON TRIP') status = 'ON_DUTY';
    else if (rawSt === 'RESTING' || rawSt === 'INACTIVE') status = 'RESTING';
    else if (rawSt === 'SUSPENDED') status = 'SUSPENDED';
    else if (rawSt === 'LEAVE') status = 'LEAVE';
    else status = rawSt || 'AVAILABLE';

    const expYears = d.experience_years !== undefined && d.experience_years !== null
      ? `${d.experience_years} năm kinh nghiệm`
      : null;

    return {
      key: `D${d.id}`,
      id: d.id,
      user_id: d.user_account_id,
      name: u.full_name || (u.username ? `Tài xế ${u.username}` : `Tài xế ${d.id}`),
      phone: u.phone || null,
      email: u.email || null,
      id_card: null,
      license_type: d.license_class ? `Hạng ${d.license_class}` : null,
      license_class: d.license_class || null,
      license_number: d.license_number || null,
      expiry: d.license_expiry || null,
      license_expiry: d.license_expiry || null,
      experience_years: expYears,
      shift_hours_today: d.shift_hours_today ?? null,
      max_shift_hours: null,
      assigned_truck: d.assigned_truck || null,
      current_trip: null,
      status: status,
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
  return (vendors || []).map(v => {
    const rawStatus = String(v.approval_status || '').toUpperCase();
    let status = 'PENDING';
    if (rawStatus === 'APPROVED') status = 'APPROVED';
    else if (rawStatus === 'REJECTED') status = 'REJECTED';
    else status = 'PENDING';

    return {
      id: v.id.toString(),
      key: v.id.toString(),
      name: v.company_name,
      contact_person: v.contact_person,
      phone: v.phone,
      truck_types: v.truck_types,
      status: status,
      rating: v.rating !== undefined && v.rating !== null ? Number(v.rating) : null
    };
  });
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

const createServiceError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const STRICT_HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const STRICT_YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseStrictDateStr = (dateStr) => {
  const clean = String(dateStr || '').split('T')[0].trim();
  const match = STRICT_YMD_REGEX.exec(clean);
  if (!match) {
    throw createServiceError('Ngày làm việc phải đúng định dạng YYYY-MM-DD.', 400);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    throw createServiceError('Ngày làm việc không hợp lệ.', 400);
  }
  return clean;
};

const parseShiftDateTimeRange = (dateStr, startStr, endStr) => {
  const cleanDate = parseStrictDateStr(dateStr);
  const rawStart = String(startStr || '').trim();
  const rawEnd = String(endStr || '').trim();

  let isoStart;
  let isoEnd;

  if (!rawStart.includes('T') && !rawEnd.includes('T')) {
    const mStart = STRICT_HHMM_REGEX.exec(rawStart);
    const mEnd = STRICT_HHMM_REGEX.exec(rawEnd);
    if (!mStart || !mEnd) {
      throw createServiceError('Giờ bắt đầu và giờ kết thúc phải đúng định dạng HH:mm (00:00 - 23:59).', 400);
    }
    const startMins = Number(mStart[1]) * 60 + Number(mStart[2]);
    const endMins = Number(mEnd[1]) * 60 + Number(mEnd[2]);
    if (startMins === endMins) {
      throw createServiceError('Giờ kết thúc phải khác giờ bắt đầu.', 400);
    }
    isoStart = `${cleanDate}T${rawStart}:00+07:00`;
    const endDate = endMins < startMins ? addDaysStrGMT7(cleanDate, 1) : cleanDate;
    isoEnd = `${endDate}T${rawEnd}:00+07:00`;
  } else {
    const startMs = Date.parse(rawStart);
    const endMs = Date.parse(rawEnd);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw createServiceError('Thời gian bắt đầu hoặc kết thúc ca làm việc không hợp lệ.', 400);
    }
    if (endMs <= startMs) {
      throw createServiceError('Giờ kết thúc phải sau giờ bắt đầu.', 400);
    }
    isoStart = new Date(startMs).toISOString();
    isoEnd = new Date(endMs).toISOString();
  }

  const durationHours = (new Date(isoEnd).getTime() - new Date(isoStart).getTime()) / (1000 * 60 * 60);
  if (durationHours <= 0 || durationHours > 24) {
    throw createServiceError('Thời lượng ca làm việc phải lớn hơn 0 giờ và không vượt quá 24 giờ.', 400);
  }

  return { cleanDate, isoStart, isoEnd, durationHours: Number(durationHours.toFixed(1)) };
};

const safeNotifyShift = async (payload) => {
  try {
    await driverModel.createSystemNotification(payload);
  } catch (notifErr) {
    console.warn('Shift notification warning:', notifErr.message);
  }
};

const buildBr34Warnings = async (driverId, dateStr, shiftDurationHours) => {
  const warnings = [];
  if (shiftDurationHours > 4) {
    warnings.push(`Ca làm việc kéo dài ${shiftDurationHours}h liên tục (> 4 giờ cần bố trí nghỉ giữa ca theo BR-34)`);
  }
  const [totalDailyHours, totalWeeklyHours] = await Promise.all([
    driverModel.calculateDriverDailyHours(driverId, dateStr),
    driverModel.calculateDriverWeeklyHours(driverId, dateStr)
  ]);
  if (totalDailyHours > 10) {
    warnings.push(`tổng giờ trong ngày đạt ${totalDailyHours}h (> 10 giờ/ngày)`);
  }
  if (totalWeeklyHours > 48) {
    warnings.push(`tổng giờ trong tuần đạt ${totalWeeklyHours}h (> 48 giờ/tuần)`);
  }
  return warnings.length > 0 ? `Cảnh báo BR-34: ${warnings.join('; ')}.` : null;
};

const createShift = async ({ driver_id, date, start_time, end_time, note, creatorId }) => {
  if (!driver_id || !date || !start_time || !end_time) {
    throw createServiceError('Tài xế, ngày và khoảng thời gian bắt đầu - kết thúc là bắt buộc', 400);
  }

  const { cleanDate, isoStart, isoEnd, durationHours } = parseShiftDateTimeRange(date, start_time, end_time);

  const hasOverlap = await driverModel.checkShiftOverlap(driver_id, cleanDate, isoStart, isoEnd);
  if (hasOverlap) {
    throw createServiceError('Lỗi: Tài xế này đã có ca làm việc khác chồng lấn thời gian (kể cả ca qua đêm).', 409);
  }

  const newShift = await driverModel.insertShiftRecord({
    driver_id,
    date: cleanDate,
    start_time: isoStart,
    end_time: isoEnd,
    note: note || 'Ca trực do Quản lý tạo',
    status: 'Approved',
    created_by: creatorId,
    registered_by: creatorId,
    reviewed_by: creatorId,
    reviewed_at: new Date().toISOString()
  });

  const warningMessage = await buildBr34Warnings(driver_id, cleanDate, durationHours);

  const driverProfile = newShift?.driver_profiles;
  if (driverProfile?.user_account_id) {
    await safeNotifyShift({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: newShift.id,
      message: `Quản lý đã xếp ca làm việc cho bạn vào ngày ${cleanDate}.`
    });
  }

  return { shift: newShift, warning: warningMessage };
};

const updateShift = async (id, { date, start_time, end_time, note, reviewerId }) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw createServiceError('Không tìm thấy ca làm việc.', 404);
  }

  const isTripLocked = await driverModel.hasActiveTripDuringShift(
    existing.driver_id,
    existing.start_time,
    existing.end_time
  );
  if (isTripLocked) {
    throw createServiceError('Không thể chỉnh sửa ca làm việc đang được gắn cho chuyến xe đang hoạt động.', 409);
  }

  const targetDate = date || existing.date;
  const rawStart = start_time || existing.start_time;
  const rawEnd = end_time || existing.end_time;
  const { cleanDate, isoStart, isoEnd, durationHours } = parseShiftDateTimeRange(targetDate, rawStart, rawEnd);

  const hasOverlap = await driverModel.checkShiftOverlap(existing.driver_id, cleanDate, isoStart, isoEnd, id);
  if (hasOverlap) {
    throw createServiceError('Lỗi: Thời gian mới bị chồng lấn với ca làm việc khác của tài xế.', 409);
  }

  const updated = await driverModel.updateDriverShift(id, {
    date: cleanDate,
    start_time: isoStart,
    end_time: isoEnd,
    note: note !== undefined ? note : existing.note,
    reviewed_by: reviewerId || existing.reviewed_by
  });

  const warningMessage = await buildBr34Warnings(existing.driver_id, cleanDate, durationHours);

  return { shift: updated, warning: warningMessage };
};

const approveShift = async (id, reviewerId) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw createServiceError('Không tìm thấy ca làm việc.', 404);
  }

  const curStatus = String(existing.status || '').toUpperCase();
  if (!['REQUESTED', 'PENDING'].includes(curStatus)) {
    throw createServiceError('Chỉ có thể phê duyệt ca làm việc đang ở trạng thái Chờ duyệt.', 409);
  }

  const updated = await driverModel.updateDriverShift(id, {
    status: 'Approved',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString()
  });

  const durationHours = Number(
    ((new Date(existing.end_time).getTime() - new Date(existing.start_time).getTime()) / (1000 * 60 * 60)).toFixed(1)
  );
  const warningMessage = await buildBr34Warnings(existing.driver_id, existing.date, durationHours);

  const driverProfile = existing.driver_profiles;
  if (driverProfile?.user_account_id) {
    await safeNotifyShift({
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
    throw createServiceError('Không tìm thấy ca làm việc.', 404);
  }

  const curStatus = String(existing.status || '').toUpperCase();
  if (!['REQUESTED', 'PENDING'].includes(curStatus)) {
    throw createServiceError('Chỉ có thể từ chối ca làm việc đang ở trạng thái Chờ duyệt.', 409);
  }

  const isTripLocked = await driverModel.hasActiveTripDuringShift(
    existing.driver_id,
    existing.start_time,
    existing.end_time
  );
  if (isTripLocked) {
    throw createServiceError('Không thể từ chối ca làm việc đang được gắn cho chuyến xe.', 409);
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
    await safeNotifyShift({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: existing.id,
      message: `Ca làm việc ngày ${existing.date} đã bị từ chối. Lý do: ${rejectionReason}`
    });
  }

  return { shift: updated };
};

const deleteShift = async (id) => {
  const existing = await driverModel.getShiftById(id);
  if (!existing) {
    throw createServiceError('Không tìm thấy ca làm việc.', 404);
  }

  const isTripLocked = await driverModel.hasActiveTripDuringShift(
    existing.driver_id,
    existing.start_time,
    existing.end_time
  );
  if (isTripLocked) {
    throw createServiceError('Không thể xóa ca làm việc đang được gắn cho chuyến xe đang hoạt động.', 409);
  }

  await driverModel.deleteDriverShift(id);

  const driverProfile = existing.driver_profiles;
  if (driverProfile?.user_account_id) {
    await safeNotifyShift({
      userAccountId: driverProfile.user_account_id,
      targetType: 'SHIFT',
      targetId: existing.id,
      message: `Ca làm việc ngày ${existing.date} của bạn đã bị Quản lý hủy/xóa.`
    });
  }
  return true;
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

const getLeaveRequests = async ({ status = null } = {}) => {
  return await leaveModel.getLeaveRequests({ status });
};

const decideLeaveRequest = async ({ id, decision, comment = '', reviewerId = null }) => {
  const normDecision = String(decision || '').trim().toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normDecision)) {
    const err = new Error('Quyết định không hợp lệ (chỉ chấp nhận APPROVED hoặc REJECTED).');
    err.statusCode = 400;
    throw err;
  }

  const found = await leaveModel.getLeaveRequestById(id);
  if (!found || !found.raw) {
    const err = new Error('Không tìm thấy đơn báo nghỉ đột xuất này.');
    err.statusCode = 404;
    throw err;
  }

  const current = found.formatted;
  if (current.status !== 'PENDING') {
    const err = new Error(`Đơn xin nghỉ này đã được xử lý trước đó (${current.status}).`);
    err.statusCode = 400;
    throw err;
  }

  const cleanComment = String(comment || '').trim();
  if (normDecision === 'REJECTED' && !cleanComment) {
    const err = new Error('Vui lòng nhập lý do từ chối đơn xin nghỉ.');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const reviewerName = (await leaveModel.getUserDisplayName(reviewerId)) || 'Quản lý';
  const rawChanges =
    typeof found.raw.changes === 'object' && found.raw.changes
      ? { ...found.raw.changes }
      : JSON.parse(found.raw.changes || '{}');

  const dateDisplay = (current.leave_dates || []).map((d) => d.split('-').reverse().join('/')).join(', ');

  if (normDecision === 'REJECTED') {
    const nextChanges = {
      ...rawChanges,
      status: 'REJECTED',
      manager_comment: cleanComment,
      reviewed_by: reviewerId ? Number(reviewerId) : null,
      reviewed_by_name: reviewerName,
      reviewed_at: nowIso,
    };
    await leaveModel.updateLeaveRequestChanges(current.id, nextChanges);

    if (current.driver_user_id) {
      await driverModel.createSystemNotification({
        userAccountId: current.driver_user_id,
        targetType: 'SHIFT',
        targetId: current.id,
        message: `Đơn báo nghỉ đột xuất các ngày ${dateDisplay} của bạn đã bị Quản lý từ chối. Lý do: ${cleanComment}`,
      });
    }

    const updated = await leaveModel.getLeaveRequestById(current.id);
    return {
      leaveRequest: updated?.formatted || { ...current, status: 'REJECTED', manager_comment: cleanComment },
      cancelledShiftsCount: 0,
      releasedTripIds: [],
      message: 'Đã từ chối đơn báo nghỉ đột xuất và thông báo cho tài xế.',
    };
  }

  // Trường hợp APPROVED:
  // 1. Lấy mới nhất các chuyến xe active của tài xế trong các ngày xin nghỉ
  const liveAffectedTrips = await leaveModel.getDriverAffectedTripsByDates(current.driver_id, current.leave_dates);
  const storedMap = new Map((current.affected_trips || []).map((t) => [Number(t.trip_id), t]));
  liveAffectedTrips.forEach((t) => {
    if (!storedMap.has(Number(t.trip_id))) {
      storedMap.set(Number(t.trip_id), t);
    }
  });
  const mergedAffectedTrips = [...storedMap.values()];
  const affectedTripIds = mergedAffectedTrips.map((t) => Number(t.trip_id)).filter(Boolean);

  // 2. Giải phóng phân công tài xế khỏi các chuyến bị ảnh hưởng -> chờ Dispatcher đổi tài xế
  const releasedTripIds = await leaveModel.releaseDriverFromTripsOnApproval(
    current.driver_id,
    affectedTripIds,
    current.reason
  );

  // 3. Đánh dấu Rejected (nghỉ đột xuất) các ca trực trong các ngày được duyệt
  const cancelledShiftsCount = await leaveModel.markDriverShiftsOnDatesAsLeaveApproved(
    current.driver_id,
    current.leave_dates,
    current.reason,
    reviewerId
  );

  // 4. Lưu trạng thái APPROVED
  const nextChanges = {
    ...rawChanges,
    status: 'APPROVED',
    affected_trips: mergedAffectedTrips,
    manager_comment: cleanComment || 'Đã duyệt cho nghỉ đột xuất',
    reviewed_by: reviewerId ? Number(reviewerId) : null,
    reviewed_by_name: reviewerName,
    reviewed_at: nowIso,
  };
  await leaveModel.updateLeaveRequestChanges(current.id, nextChanges);

  // 5. Thông báo cho Tài xế
  if (current.driver_user_id) {
    await driverModel.createSystemNotification({
      userAccountId: current.driver_user_id,
      targetType: 'SHIFT',
      targetId: current.id,
      message: `Đơn báo nghỉ đột xuất các ngày ${dateDisplay} đã được Quản lý duyệt.${
        releasedTripIds.length > 0
          ? ` ${releasedTripIds.length} chuyến xe bị ảnh hưởng sẽ được Điều phối viên bàn giao cho tài xế khác.`
          : ''
      }`,
    });
  }

  // 6. Thông báo cho tất cả Điều phối viên (role_id = 3) để Re-assign tài xế mới
  try {
    const dispatchers = await leaveModel.getActiveUsersByRoles([3]);
    const tripCodesText = mergedAffectedTrips.map((t) => t.trip_code).join(', ');
    for (const disp of dispatchers) {
      await driverModel.createSystemNotification({
        userAccountId: disp.id,
        targetType: 'TRIP',
        targetId: releasedTripIds[0] || current.id,
        message:
          releasedTripIds.length > 0
            ? `[Cần đổi tài xế] Tài xế ${current.driver_name} được Quản lý duyệt nghỉ đột xuất ngày ${dateDisplay}. Cần Re-assign ${releasedTripIds.length} chuyến: ${tripCodesText}.`
            : `[Thông báo nghỉ đột xuất] Tài xế ${current.driver_name} được duyệt nghỉ ngày ${dateDisplay}. Lưu ý không điều phối chuyến vào ngày này.`,
      });
    }
  } catch (dispNotifErr) {
    console.warn('Notify dispatchers on approved leave warning:', dispNotifErr.message);
  }

  const updated = await leaveModel.getLeaveRequestById(current.id);
  return {
    leaveRequest: updated?.formatted || { ...current, status: 'APPROVED', affected_trips: mergedAffectedTrips },
    cancelledShiftsCount,
    releasedTripIds,
    message:
      releasedTripIds.length > 0
        ? `Đã duyệt nghỉ đột xuất cho ${current.driver_name}. Đã chuyển ${releasedTripIds.length} chuyến xe sang Điều phối viên để Re-assign tài xế mới.`
        : `Đã duyệt đơn nghỉ đột xuất cho ${current.driver_name} và cập nhật ${cancelledShiftsCount} ngày ca trực.`,
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
  getLeaveRequests,
  decideLeaveRequest,
};

