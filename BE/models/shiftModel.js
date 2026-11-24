const prisma = require("../config/prisma");
const { serializePrisma, toBigInt, formatDateOnly } = require("../utils/prismaHelper");

const toDateObj = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const clean = String(dateStr).split("T")[0].trim();
  return new Date(`${clean}T00:00:00.000Z`);
};

const formatShiftRow = (row) => {
  if (!row) return null;
  const s = serializePrisma(row);
  return {
    ...s,
    date: formatDateOnly(row.date),
  };
};

// ==========================================
// DRIVER SHIFTS
// ==========================================

const getDriverShifts = async (driverProfileId, { from = null, to = null } = {}) => {
  const where = { driver_id: toBigInt(driverProfileId) };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = toDateObj(from);
    if (to) where.date.lte = toDateObj(to);
  }

  const rows = await prisma.driver_shifts.findMany({
    where,
    select: {
      id: true,
      driver_id: true,
      date: true,
      start_time: true,
      end_time: true,
      status: true,
      note: true,
      rejection_reason: true,
      registered_by: true,
      reviewed_by: true,
      reviewed_at: true,
      created_at: true,
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });

  return rows.map(formatShiftRow);
};

const checkShiftOverlap = async (driverProfileId, date, startTime, endTime, excludeShiftId = null) => {
  const where = {
    driver_id: toBigInt(driverProfileId),
    date: toDateObj(date),
    status: { in: ["Requested", "Approved"] },
  };
  if (excludeShiftId) {
    where.id = { not: toBigInt(excludeShiftId) };
  }

  const rows = await prisma.driver_shifts.findMany({
    where,
    select: { id: true, start_time: true, end_time: true, status: true },
  });

  if (!rows || rows.length === 0) return false;

  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  for (const s of rows) {
    const existingStart = new Date(s.start_time).getTime();
    const existingEnd = new Date(s.end_time).getTime();
    if (Math.max(newStart, existingStart) < Math.min(newEnd, existingEnd)) {
      return true;
    }
  }

  return false;
};

const createDriverShift = async ({
  driverId,
  date,
  startTime,
  endTime,
  note = null,
  registeredBy,
}) => {
  const now = new Date();
  const created = await prisma.driver_shifts.create({
    data: {
      driver_id: toBigInt(driverId),
      date: toDateObj(date),
      start_time: new Date(startTime),
      end_time: new Date(endTime),
      note,
      status: "Requested",
      registered_by: toBigInt(registeredBy),
      created_at: now,
      updated_at: now,
    },
  });
  return formatShiftRow(created);
};

const SHIFT_WITH_DRIVER_SELECT = {
  id: true,
  driver_id: true,
  date: true,
  start_time: true,
  end_time: true,
  status: true,
  note: true,
  rejection_reason: true,
  created_by: true,
  registered_by: true,
  reviewed_by: true,
  reviewed_at: true,
  created_at: true,
  updated_at: true,
  driver_profiles: {
    select: {
      id: true,
      user_account_id: true,
      license_number: true,
      license_class: true,
      users: {
        select: {
          id: true,
          full_name: true,
          phone: true,
          username: true,
        },
      },
    },
  },
};

const getShiftsWithDriverInfo = async ({ from = null, to = null, status = null, driverId = null } = {}) => {
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = toDateObj(from);
    if (to) where.date.lte = toDateObj(to);
  }
  if (status && status !== "ALL") where.status = status;
  if (driverId) where.driver_id = toBigInt(driverId);

  const rows = await prisma.driver_shifts.findMany({
    where,
    select: SHIFT_WITH_DRIVER_SELECT,
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
  return rows.map(formatShiftRow);
};

const getShiftById = async (id) => {
  const shiftId = toBigInt(id);
  if (shiftId === null) return null;
  const row = await prisma.driver_shifts.findUnique({
    where: { id: shiftId },
    select: SHIFT_WITH_DRIVER_SELECT,
  });
  return formatShiftRow(row);
};

const insertShiftRecord = async (shiftData) => {
  const now = new Date();
  const dataPayload = {
    driver_id: toBigInt(shiftData.driver_id),
    date: toDateObj(shiftData.date),
    start_time: new Date(shiftData.start_time),
    end_time: new Date(shiftData.end_time),
    status: shiftData.status || "Requested",
    note: shiftData.note ?? null,
    rejection_reason: shiftData.rejection_reason ?? null,
    created_by: toBigInt(shiftData.created_by),
    registered_by: toBigInt(shiftData.registered_by),
    reviewed_by: toBigInt(shiftData.reviewed_by),
    reviewed_at: shiftData.reviewed_at ? new Date(shiftData.reviewed_at) : null,
    created_at: now,
    updated_at: now,
  };

  const row = await prisma.driver_shifts.create({
    data: dataPayload,
    select: SHIFT_WITH_DRIVER_SELECT,
  });
  return formatShiftRow(row);
};

const updateDriverShift = async (id, updateFields) => {
  const dataPayload = { updated_at: new Date() };
  if (updateFields.driver_id !== undefined) dataPayload.driver_id = toBigInt(updateFields.driver_id);
  if (updateFields.date !== undefined) dataPayload.date = toDateObj(updateFields.date);
  if (updateFields.start_time !== undefined) dataPayload.start_time = new Date(updateFields.start_time);
  if (updateFields.end_time !== undefined) dataPayload.end_time = new Date(updateFields.end_time);
  if (updateFields.status !== undefined) dataPayload.status = updateFields.status;
  if (updateFields.note !== undefined) dataPayload.note = updateFields.note;
  if (updateFields.rejection_reason !== undefined) dataPayload.rejection_reason = updateFields.rejection_reason;
  if (updateFields.registered_by !== undefined) dataPayload.registered_by = toBigInt(updateFields.registered_by);
  if (updateFields.reviewed_by !== undefined) dataPayload.reviewed_by = toBigInt(updateFields.reviewed_by);
  if (updateFields.reviewed_at !== undefined) {
    dataPayload.reviewed_at = updateFields.reviewed_at ? new Date(updateFields.reviewed_at) : null;
  }

  const row = await prisma.driver_shifts.update({
    where: { id: toBigInt(id) },
    data: dataPayload,
    select: SHIFT_WITH_DRIVER_SELECT,
  });
  return formatShiftRow(row);
};

const deleteDriverShift = async (id) => {
  await prisma.driver_shifts.delete({
    where: { id: toBigInt(id) },
  });
  return true;
};

const calculateDriverDailyHours = async (driverProfileId, date) => {
  try {
    const rows = await prisma.driver_shifts.findMany({
      where: {
        driver_id: toBigInt(driverProfileId),
        date: toDateObj(date),
        status: "Approved",
      },
      select: { start_time: true, end_time: true },
    });

    let totalHours = 0;
    (rows || []).forEach((sh) => {
      try {
        const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
        if (diff > 0) totalHours += diff;
      } catch {
        // ignore
      }
    });
    return Number(totalHours.toFixed(1));
  } catch (error) {
    console.error("calculateDriverDailyHours error:", error);
    return 0;
  }
};

const bulkInsertDriverShifts = async (shiftPayloads) => {
  if (!Array.isArray(shiftPayloads) || shiftPayloads.length === 0) return [];
  const now = new Date();

  const created = await prisma.$transaction(
    shiftPayloads.map((p) =>
      prisma.driver_shifts.create({
        data: {
          driver_id: toBigInt(p.driver_id),
          date: toDateObj(p.date),
          start_time: new Date(p.start_time),
          end_time: new Date(p.end_time),
          status: p.status || "Requested",
          note: p.note ?? null,
          rejection_reason: p.rejection_reason ?? null,
          created_by: toBigInt(p.created_by),
          registered_by: toBigInt(p.registered_by),
          reviewed_by: toBigInt(p.reviewed_by),
          reviewed_at: p.reviewed_at ? new Date(p.reviewed_at) : null,
          created_at: p.created_at ? new Date(p.created_at) : now,
          updated_at: p.updated_at ? new Date(p.updated_at) : now,
        },
      })
    )
  );
  return created.map(formatShiftRow);
};

const getShiftsInRange = async (driverProfileId, startDate, endDate) => {
  const rows = await prisma.driver_shifts.findMany({
    where: {
      driver_id: toBigInt(driverProfileId),
      date: {
        gte: toDateObj(startDate),
        lte: toDateObj(endDate),
      },
      status: { in: ["Requested", "Approved"] },
    },
    select: {
      id: true,
      driver_id: true,
      date: true,
      start_time: true,
      end_time: true,
      status: true,
      note: true,
      registered_by: true,
      created_by: true,
    },
  });
  return rows.map(formatShiftRow);
};

const getAllActiveDriverProfiles = async () => {
  const rows = await prisma.driver_profiles.findMany({
    where: {
      status: {
        notIn: ["INACTIVE", "Inactive", "LOCKED", "Locked", "Suspended", "SUSPENDED"],
      },
    },
    select: {
      id: true,
      user_account_id: true,
      status: true,
      users: {
        select: {
          id: true,
          full_name: true,
          username: true,
          status: true,
        },
      },
    },
  });

  return serializePrisma(rows).filter((d) => {
    const uStatus = String(d.users?.status || "ACTIVE").toUpperCase();
    return uStatus !== "INACTIVE" && uStatus !== "LOCKED";
  });
};

const getAllShiftsBetweenDates = async (fromDate, toDate) => {
  const rows = await prisma.driver_shifts.findMany({
    where: {
      date: {
        gte: toDateObj(fromDate),
        lte: toDateObj(toDate),
      },
      status: { in: ["Requested", "Approved"] },
    },
    select: {
      id: true,
      driver_id: true,
      date: true,
      start_time: true,
      end_time: true,
      status: true,
      note: true,
      registered_by: true,
      created_by: true,
    },
  });
  return rows.map(formatShiftRow);
};

const getWeekMondaySundayFromDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(dt.getTime() + diffToMon * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  return {
    weekStart: mon.toISOString().split("T")[0],
    weekEnd: sun.toISOString().split("T")[0],
  };
};

const cancelDriverShiftRequest = async (shiftId, driverProfileId) => {
  const existing = await prisma.driver_shifts.findFirst({
    where: {
      id: toBigInt(shiftId),
      driver_id: toBigInt(driverProfileId),
    },
    select: { id: true, status: true, driver_id: true, date: true, note: true, registered_by: true },
  });

  if (!existing) {
    throw new Error("Không tìm thấy ca làm việc hoặc bạn không có quyền hủy.");
  }

  const isAutoAssigned =
    (existing.note && existing.note.includes("[Hệ thống tự động xếp lịch]")) ||
    existing.registered_by === null;

  if (isAutoAssigned || existing.status === "Approved") {
    const err = new Error("Lịch làm việc đã được hệ thống tự động xếp hoặc đã duyệt, không thể hủy hay chỉnh sửa!");
    err.statusCode = 400;
    throw err;
  }

  if (existing.status !== "Requested") {
    throw new Error("Chỉ có thể hủy ca làm việc đang ở trạng thái Chờ duyệt.");
  }

  const { weekStart, weekEnd } = getWeekMondaySundayFromDateStr(formatDateOnly(existing.date));
  const weekShifts = await getShiftsInRange(driverProfileId, weekStart, weekEnd);
  const hasLockedShift = weekShifts.some(
    (sh) =>
      sh.status === "Approved" ||
      (sh.note && sh.note.includes("[Hệ thống tự động xếp lịch]")) ||
      sh.registered_by === null
  );
  if (hasLockedShift) {
    const err = new Error("Tuần này đã có lịch được duyệt hoặc tự động xếp, không thể hủy hay chỉnh sửa!");
    err.statusCode = 400;
    throw err;
  }

  const deletedRes = await prisma.driver_shifts.deleteMany({
    where: {
      driver_id: toBigInt(driverProfileId),
      date: { gte: toDateObj(weekStart), lte: toDateObj(weekEnd) },
      status: "Requested",
    },
  });
  return { deletedCount: deletedRes.count || 0, weekStart, weekEnd };
};

const bulkApproveDriverShiftsInRange = async (driverProfileId, startDate, endDate, reviewerId) => {
  const now = new Date();
  const where = {
    driver_id: toBigInt(driverProfileId),
    date: { gte: toDateObj(startDate), lte: toDateObj(endDate) },
    status: "Requested",
  };

  const targetIds = (
    await prisma.driver_shifts.findMany({ where, select: { id: true } })
  ).map((r) => r.id);

  if (targetIds.length === 0) return [];

  await prisma.driver_shifts.updateMany({
    where: { id: { in: targetIds } },
    data: {
      status: "Approved",
      reviewed_by: toBigInt(reviewerId),
      reviewed_at: now,
      updated_at: now,
    },
  });

  const updated = await prisma.driver_shifts.findMany({
    where: { id: { in: targetIds } },
  });
  return updated.map(formatShiftRow);
};

const getSystemSettingValue = async (key) => {
  try {
    const row = await prisma.system_settings.findUnique({
      where: { key },
      select: { value: true },
    });
    return row ? row.value : null;
  } catch (error) {
    console.error("getSystemSettingValue error:", error);
    return null;
  }
};

module.exports = {
  getDriverShifts,
  checkShiftOverlap,
  createDriverShift,
  bulkInsertDriverShifts,
  getShiftsInRange,
  getAllActiveDriverProfiles,
  getAllShiftsBetweenDates,
  bulkApproveDriverShiftsInRange,
  getWeekMondaySundayFromDateStr,
  getSystemSettingValue,
  getShiftsWithDriverInfo,
  getShiftById,
  insertShiftRecord,
  updateDriverShift,
  deleteDriverShift,
  calculateDriverDailyHours,
  cancelDriverShiftRequest,
};
