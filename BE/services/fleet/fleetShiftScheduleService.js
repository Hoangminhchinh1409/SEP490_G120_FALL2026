const driverModel = require('../../models/driverModel');

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

    const shiftLabel = shiftType === 'MORNING' ? 'Ca Sáng (08:00 - 18:00)' : 'Ca Đêm (19:00 - 07:00 hôm sau)';
    const rows = [];
    let cur = nextMonday;
    while (cur <= nextSunday) {
      const startIso = shiftType === 'MORNING' ? `${cur}T08:00:00+07:00` : `${cur}T19:00:00+07:00`;
      const endDate = shiftType === 'MORNING' ? cur : addDaysStrGMT7(cur, 1);
      const endIso = shiftType === 'MORNING' ? `${endDate}T18:00:00+07:00` : `${endDate}T07:00:00+07:00`;
      rows.push({
        driver_id: drv.id,
        date: cur,
        start_time: startIso,
        end_time: endIso,
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
  const shiftLabel = normalizedType === 'MORNING' ? 'Ca Sáng (08:00 - 18:00)' : 'Ca Đêm (19:00 - 07:00 hôm sau)';
  const existingShifts = await driverModel.getShiftsInRange(Number(driverId), mon, sun);

  let updatedList = [];
  if (!existingShifts || existingShifts.length === 0) {
    const rows = [];
    let cur = mon;
    const nowIso = new Date().toISOString();
    while (cur <= sun) {
      const startIso = normalizedType === 'MORNING' ? `${cur}T08:00:00+07:00` : `${cur}T19:00:00+07:00`;
      const endDate = normalizedType === 'MORNING' ? cur : addDaysStrGMT7(cur, 1);
      const endIso = normalizedType === 'MORNING' ? `${endDate}T18:00:00+07:00` : `${endDate}T07:00:00+07:00`;
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
      const startIso = normalizedType === 'MORNING' ? `${dStr}T08:00:00+07:00` : `${dStr}T19:00:00+07:00`;
      const endDate = normalizedType === 'MORNING' ? dStr : addDaysStrGMT7(dStr, 1);
      const endIso = normalizedType === 'MORNING' ? `${endDate}T18:00:00+07:00` : `${endDate}T07:00:00+07:00`;
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
  addDaysStrGMT7,
  getGMT7WeekScheduleContext,
  sendShiftDeadlineReminders,
  autoAssignNextWeekShifts,
  approveDriverWeekShifts,
  switchDriverWeekShiftType
};
