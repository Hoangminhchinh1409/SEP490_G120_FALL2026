const driverModel = require("../../models/driverModel");
const leaveModel = require("../../models/leaveModel");
const {
  getMyProfile,
  getActiveTrip,
  addDaysStr,
  getMondaySundayOfDate,
  getNowGMT7Info,
  normalizeWeeklyShiftType,
} = require("./driverHelper");

// ==========================================
// 10. DRIVER SHIFTS
// ==========================================

const getMyShifts = async (userId, { from = null, to = null } = {}) => {
  const profile = await getMyProfile(userId);
  return await driverModel.getDriverShifts(profile.id, { from, to });
};

const registerShift = async (userId, shiftData = {}) => {
  const profile = await getMyProfile(userId);
  const { week_start, date, shift_type, start_time, note = null } = shiftData;

  const shiftType = normalizeWeeklyShiftType({ shift_type, start_time });
  if (!shiftType) {
    const err = new Error(
      "Vui lòng chọn ca làm việc hợp lệ: Ca Sáng (08:00 - 18:00) hoặc Ca Đêm (19:00 - 07:00 hôm sau).",
    );
    err.statusCode = 400;
    throw err;
  }

  const nowInfo = getNowGMT7Info();
  const anchorInput = week_start || date || nowInfo.nextMondayStr;
  const anchorDateStr = String(anchorInput).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDateStr)) {
    const err = new Error(
      "Định dạng ngày/tuần đăng ký không hợp lệ (YYYY-MM-DD).",
    );
    err.statusCode = 400;
    throw err;
  }

  const { weekStart, weekEnd } = getMondaySundayOfDate(anchorDateStr);

  if (weekEnd < nowInfo.todayStr) {
    const err = new Error("Không thể đăng ký lịch làm việc cho tuần đã qua.");
    err.statusCode = 400;
    throw err;
  }

  // Kiểm tra hạn chót 22:00 Chủ Nhật cho tuần tới
  if (
    weekStart === nowInfo.nextMondayStr &&
    nowInfo.dayOfWeek === 0 &&
    nowInfo.hour >= 22
  ) {
    const err = new Error(
      "Đã quá hạn chót 22:00 Chủ Nhật để đăng ký tuần tới. Hệ thống sẽ tự động xếp lịch cố định.",
    );
    err.statusCode = 400;
    throw err;
  }

  const existingShifts = await driverModel.getShiftsInRange(
    profile.id,
    weekStart,
    weekEnd,
  );
  const activeShifts = existingShifts.filter((sh) => sh.status !== "Rejected");

  const hasLockedShift = activeShifts.some(
    (sh) =>
      sh.status === "Approved" ||
      (sh.note && sh.note.includes("[Hệ thống tự động xếp lịch]")) ||
      sh.registered_by === null,
  );
  if (hasLockedShift) {
    const err = new Error(
      "Lịch làm việc tuần này đã được duyệt hoặc hệ thống tự động xếp, không thể sửa đổi!",
    );
    err.statusCode = 400;
    throw err;
  }

  if (activeShifts.length > 0) {
    const err = new Error(
      "Bạn đã gửi đăng ký ca cho tuần này (đang chờ duyệt). Vui lòng hủy đăng ký tuần trước khi chọn lại.",
    );
    err.statusCode = 400;
    throw err;
  }

  const shiftLabel =
    shiftType === "MORNING"
      ? "Ca Sáng (08:00 - 18:00)"
      : "Ca Đêm (19:00 - 07:00 hôm sau)";
  const effectiveStartDate =
    weekStart < nowInfo.todayStr ? nowInfo.todayStr : weekStart;
  const shiftPayloads = [];

  let curDate = effectiveStartDate;
  while (curDate <= weekEnd) {
    const startIso =
      shiftType === "MORNING"
        ? `${curDate}T08:00:00+07:00`
        : `${curDate}T19:00:00+07:00`;
    const endDate = shiftType === "MORNING" ? curDate : addDaysStr(curDate, 1);
    const endIso =
      shiftType === "MORNING"
        ? `${endDate}T18:00:00+07:00`
        : `${endDate}T07:00:00+07:00`;
    const trimmedNote =
      note && String(note).trim() ? String(note).trim() : null;
    const finalNote = trimmedNote
      ? `[${shiftLabel}] ${trimmedNote}`
      : `[${shiftLabel}] Đăng ký ca cố định cả tuần (${weekStart} đến ${weekEnd})`;

    shiftPayloads.push({
      driver_id: profile.id,
      date: curDate,
      start_time: startIso,
      end_time: endIso,
      status: "Requested",
      note: finalNote,
      registered_by: userId,
      created_by: userId,
    });
    curDate = addDaysStr(curDate, 1);
  }

  const inserted = await driverModel.bulkInsertDriverShifts(shiftPayloads);

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "REGISTER_SHIFT_WEEK",
    targetType: "DRIVER_SHIFT",
    targetId: inserted[0]?.id || null,
    reason: `Đăng ký ${shiftLabel} cho cả tuần (${effectiveStartDate} - ${weekEnd})`,
  });

  return {
    weekStart,
    weekEnd,
    shiftType,
    shiftLabel,
    count: inserted.length,
    shifts: inserted,
  };
};

const cancelShift = async (userId, shiftId) => {
  const profile = await getMyProfile(userId);
  const result = await driverModel.cancelDriverShiftRequest(
    shiftId,
    profile.id,
  );

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "CANCEL_SHIFT_WEEK",
    targetType: "DRIVER_SHIFT",
    targetId: shiftId,
    reason: `Hủy đăng ký lịch tuần (${result.weekStart} - ${result.weekEnd}) - ${result.deletedCount} ngày`,
  });

  return {
    success: true,
    ...result,
    message: `Đã hủy đăng ký toàn bộ ${result.deletedCount} ngày trong tuần (${result.weekStart} - ${result.weekEnd}).`,
  };
};

// ==========================================
// 11. SUDDEN LEAVE REQUESTS (BÁO NGHỈ ĐỘT XUẤT)
// ==========================================

const getMyLeaveRequests = async (userId) => {
  const profile = await getMyProfile(userId);
  const leaveRequests = await leaveModel.getLeaveRequests({
    driverProfileId: profile.id,
  });
  const todayStr = leaveModel.getTodayGMT7Str();
  return {
    leaveRequests,
    todayStr,
    tomorrowStr: addDaysStr(todayStr, 1),
  };
};

const submitSuddenLeaveRequest = async (
  userId,
  { dates = [], reason = "" } = {},
) => {
  const profile = await getMyProfile(userId);
  const rawDates = Array.isArray(dates) ? dates : [];
  const cleanDates = [
    ...new Set(
      rawDates.map((d) => String(d).split("T")[0].trim()).filter(Boolean),
    ),
  ].sort();

  if (cleanDates.length === 0) {
    const err = new Error(
      "Vui lòng chọn ít nhất 1 ngày sắp tới muốn xin nghỉ.",
    );
    err.statusCode = 400;
    throw err;
  }

  const todayStr = leaveModel.getTodayGMT7Str();
  for (const dStr of cleanDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      const err = new Error(`Định dạng ngày không hợp lệ (${dStr}).`);
      err.statusCode = 400;
      throw err;
    }
    if (dStr < todayStr) {
      const err = new Error(
        `Không thể chọn ngày trong quá khứ (${dStr}). Tài xế chỉ được báo nghỉ từ hôm nay trở đi.`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // Nếu trong danh sách ngày có hôm nay (Same-day Leave)
  if (cleanDates.includes(todayStr)) {
    // Kiểm tra tài xế có đang trong chuyến xe dở dang chở hàng trên đường không
    try {
      const activeTripRes = await getActiveTrip(userId);
      const ongoingTrip = activeTripRes?.trip;
      if (
        ongoingTrip &&
        (ongoingTrip.status === "In Progress" ||
          ongoingTrip.status === "In Transit")
      ) {
        const err = new Error(
          `Bạn đang có chuyến xe đang vận chuyển hàng trên đường (${ongoingTrip.trip_code || ongoingTrip.id}). Vui lòng hoàn thành chuyến hoặc vào mục 'Báo sự cố' để điều xe/tài thay thế khẩn cấp tại hiện trường.`,
        );
        err.statusCode = 400;
        throw err;
      }
    } catch (checkErr) {
      if (checkErr.statusCode === 400) throw checkErr;
    }
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) {
    const err = new Error("Vui lòng nhập lý do xin nghỉ đột xuất.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await leaveModel.getLeaveRequests({
    driverProfileId: profile.id,
  });
  const conflictDates = [];
  existing.forEach((reqItem) => {
    if (reqItem.status === "PENDING" || reqItem.status === "APPROVED") {
      (reqItem.leave_dates || []).forEach((d) => {
        if (cleanDates.includes(d)) conflictDates.push(d);
      });
    }
  });
  if (conflictDates.length > 0) {
    const err = new Error(
      `Ngày ${[...new Set(conflictDates)].join(", ")} đã có đơn xin nghỉ đang chờ duyệt hoặc đã được duyệt.`,
    );
    err.statusCode = 400;
    throw err;
  }

  const affectedTrips = await leaveModel.getDriverAffectedTripsByDates(
    profile.id,
    cleanDates,
  );
  const isUrgent = affectedTrips.some((t) => t.is_urgent);

  const created = await leaveModel.createLeaveRequest({
    userId,
    driverProfileId: profile.id,
    dates: cleanDates,
    reason: cleanReason,
    isUrgent,
    affectedTrips,
  });

  const driverName =
    profile.user?.full_name ||
    profile.user?.username ||
    `Tài xế #${profile.id}`;
  const dateDisplay = cleanDates
    .map((d) => d.split("-").reverse().join("/"))
    .join(", ");
  const urgentPrefix = isUrgent ? "[KHẨN CẤP / CỰC GẤP] " : "";
  const tripSummaryMsg =
    affectedTrips.length > 0
      ? ` Có ${affectedTrips.length} chuyến xe bị ảnh hưởng (${affectedTrips.map((t) => t.trip_code).join(", ")})${isUrgent ? " - CÓ CHUYẾN SẮP CHẠY TRONG 2 GIỜ TỚI" : ""} cần Điều phối viên đổi tài sau khi duyệt.`
      : " Không có chuyến xe nào đang giao trong các ngày này.";

  try {
    const managers = await leaveModel.getActiveUsersByRoles([2]);
    for (const mgr of managers) {
      await driverModel.createSystemNotification({
        userAccountId: mgr.id,
        targetType: "SHIFT",
        targetId: created?.id || null,
        message: `${urgentPrefix}Tài xế ${driverName} gửi đơn báo nghỉ đột xuất ${cleanDates.includes(todayStr) ? "HÔM NAY và " : ""}các ngày ${dateDisplay}. Lý do: "${cleanReason}".${tripSummaryMsg}`,
      });
    }
  } catch (notifErr) {
    console.warn("Notify manager on leave request warning:", notifErr.message);
  }

  return {
    success: true,
    leaveRequest: created,
    affectedTrips,
    message:
      affectedTrips.length > 0
        ? `Đã gửi đơn báo nghỉ đột xuất (${cleanDates.length} ngày). ${affectedTrips.length} chuyến xe bị ảnh hưởng sẽ được Điều phối viên đổi tài xế sau khi Quản lý duyệt.`
        : `Đã gửi đơn báo nghỉ đột xuất (${cleanDates.length} ngày) tới Quản lý chờ phê duyệt.`,
  };
};

module.exports = {
  getMyShifts,
  registerShift,
  cancelShift,
  getMyLeaveRequests,
  submitSuddenLeaveRequest,
};
