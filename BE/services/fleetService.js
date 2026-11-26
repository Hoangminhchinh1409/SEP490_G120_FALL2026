const driverModel = require('../models/driverModel');
const fleetModel = require('../models/fleetModel');
const {
  getAllDrivers,
  updateDriver,
  getAllVendors,
  getLeaveRequests,
  decideLeaveRequest
} = require('./fleet/fleetDriverVendorService');
const {
  addDaysStrGMT7,
  sendShiftDeadlineReminders,
  autoAssignNextWeekShifts,
  approveDriverWeekShifts,
  switchDriverWeekShiftType
} = require('./fleet/fleetShiftScheduleService');

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
        inspectionAlertLevel = 'EXPIRED';
      } else if (daysUntilInspection <= 14) {
        inspectionAlertLevel = 'URGENT';
      } else if (daysUntilInspection <= 30) {
        inspectionAlertLevel = 'WARNING';
      } else {
        inspectionAlertLevel = 'SAFE';
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
      days_until_inspection: daysUntilInspection,
      inspection_alert_level: inspectionAlertLevel,
      is_inspection_expired: daysUntilInspection !== null ? daysUntilInspection <= 0 : false,
      current_odometer_km: currentOdo,
      last_maintenance_km: lastMaintenanceKm,
      next_maintenance_km: nextMaintenanceKm,
      km_until_maintenance: kmUntilMaintenance,
      maintenance_progress_pct: maintenanceProgressPct,
      maintenance_status: maintenanceStatus,
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
