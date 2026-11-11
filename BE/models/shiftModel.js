const supabase = require("../config/supabase");

// ==========================================
// DRIVER SHIFTS
// ==========================================

const getDriverShifts = async (
  driverProfileId,
  { from = null, to = null } = {},
) => {
  let query = supabase
    .from("driver_shifts")
    .select(
      `
      id,
      driver_id,
      date,
      start_time,
      end_time,
      status,
      note,
      rejection_reason,
      registered_by,
      reviewed_by,
      reviewed_at,
      created_at
    `,
    )
    .eq("driver_id", driverProfileId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (from) {
    query = query.gte("date", from);
  }
  if (to) {
    query = query.lte("date", to);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getDriverShifts error:", error);
    throw error;
  }
  return data || [];
};

const checkShiftOverlap = async (driverProfileId, date, startTime, endTime, excludeShiftId = null) => {
  // Tìm các ca của tài xế vào ngày đó với trạng thái Requested hoặc Approved
  let query = supabase
    .from("driver_shifts")
    .select("id, start_time, end_time, status")
    .eq("driver_id", driverProfileId)
    .eq("date", date)
    .in("status", ["Requested", "Approved"]);

  if (excludeShiftId) {
    query = query.neq("id", excludeShiftId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("checkShiftOverlap error:", error);
    throw error;
  }

  if (!data || data.length === 0) return false;

  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  for (const s of data) {
    const existingStart = new Date(s.start_time).getTime();
    const existingEnd = new Date(s.end_time).getTime();
    // Giao thoa thời gian: max(start) < min(end)
    if (Math.max(newStart, existingStart) < Math.min(newEnd, existingEnd)) {
      return true; // Bị trùng
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
  const payload = {
    driver_id: driverId,
    date,
    start_time: startTime,
    end_time: endTime,
    note,
    status: "Requested",
    registered_by: registeredBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("driver_shifts")
    .insert([payload])
    .select();

  if (error) {
    console.error("createDriverShift error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0]: null;
};

const getShiftsWithDriverInfo = async ({ from = null, to = null, status = null, driverId = null } = {}) => {
  let query = supabase
    .from("driver_shifts")
    .select(`
      id,
      driver_id,
      date,
      start_time,
      end_time,
      status,
      note,
      rejection_reason,
      created_by,
      registered_by,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      driver_profiles (
        id,
        user_account_id,
        license_number,
        license_class,
        users (
          id,
          full_name,
          phone,
          username
        )
      )
    `)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (status && status !== "ALL") query = query.eq("status", status);
  if (driverId) query = query.eq("driver_id", driverId);

  const { data, error } = await query;
  if (error) {
    console.error("getShiftsWithDriverInfo error:", error);
    throw error;
  }
  return data || [];
};

const getShiftById = async (id) => {
  const { data, error } = await supabase
    .from("driver_shifts")
    .select(`
      id,
      driver_id,
      date,
      start_time,
      end_time,
      status,
      note,
      rejection_reason,
      created_by,
      registered_by,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      driver_profiles (
        id,
        user_account_id,
        license_number,
        license_class,
        users (
          id,
          full_name,
          phone,
          username
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("getShiftById error:", error);
    return null;
  }
  return data;
};

const insertShiftRecord = async (shiftData) => {
  const payload = {
    ...shiftData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("driver_shifts")
    .insert([payload])
    .select(`
      *,
      driver_profiles (
        id,
        user_account_id,
        license_number,
        license_class,
        users (full_name, phone, username)
      )
    `)
    .single();

  if (error) {
    console.error("insertShiftRecord error:", error);
    throw error;
  }
  return data;
};

const updateDriverShift = async (id, updateFields) => {
  const payload = {
    ...updateFields,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("driver_shifts")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      driver_profiles (
        id,
        user_account_id,
        license_number,
        license_class,
        users (full_name, phone, username)
      )
    `)
    .single();

  if (error) {
    console.error("updateDriverShift error:", error);
    throw error;
  }
  return data;
};

const deleteDriverShift = async (id) => {
  const { error } = await supabase
    .from("driver_shifts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteDriverShift error:", error);
    throw error;
  }
  return true;
};

const calculateDriverDailyHours = async (driverProfileId, date) => {
  const { data, error } = await supabase
    .from("driver_shifts")
    .select("start_time, end_time")
    .eq("driver_id", driverProfileId)
    .eq("date", date)
    .eq("status", "Approved");

  if (error) {
    console.error("calculateDriverDailyHours error:", error);
    return 0;
  }

  let totalHours = 0;
  (data || []).forEach((sh) => {
    try {
      const diff = (new Date(sh.end_time) - new Date(sh.start_time)) / (1000 * 60 * 60);
      if (diff > 0) totalHours += diff;
    } catch {
      // ignore
    }
  });

  return Number(totalHours.toFixed(1));
};

const bulkInsertDriverShifts = async (shiftPayloads) => {
  if (!Array.isArray(shiftPayloads) || shiftPayloads.length === 0) return [];
  const nowIso = new Date().toISOString();
  const rows = shiftPayloads.map((p) => ({
    ...p,
    created_at: p.created_at || nowIso,
    updated_at: p.updated_at || nowIso,
  }));

  const { data, error } = await supabase
    .from("driver_shifts")
    .insert(rows)
    .select();

  if (error) {
    console.error("bulkInsertDriverShifts error:", error);
    throw error;
  }
  return data || [];
};

const getShiftsInRange = async (driverProfileId, startDate, endDate) => {
  const { data, error } = await supabase
    .from("driver_shifts")
    .select("id, driver_id, date, start_time, end_time, status, note, registered_by, created_by")
    .eq("driver_id", driverProfileId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["Requested", "Approved"]);

  if (error) {
    console.error("getShiftsInRange error:", error);
    throw error;
  }
  return data || [];
};

const getAllActiveDriverProfiles = async () => {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select(`
      id,
      user_account_id,
      status,
      users (
        id,
        full_name,
        username,
        status
      )
    `)
    .not("status", "in", '("INACTIVE","Inactive","LOCKED","Locked","Suspended","SUSPENDED")');

  if (error) {
    console.error("getAllActiveDriverProfiles error:", error);
    throw error;
  }
  return (data || []).filter((d) => {
    const uStatus = String(d.users?.status || "ACTIVE").toUpperCase();
    return uStatus !== "INACTIVE" && uStatus !== "LOCKED";
  });
};

const getAllShiftsBetweenDates = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from("driver_shifts")
    .select("id, driver_id, date, start_time, end_time, status, note, registered_by, created_by")
    .gte("date", fromDate)
    .lte("date", toDate)
    .in("status", ["Requested", "Approved"]);

  if (error) {
    console.error("getAllShiftsBetweenDates error:", error);
    throw error;
  }
  return data || [];
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
  const { data: existing, error: findError } = await supabase
    .from("driver_shifts")
    .select("id, status, driver_id, date, note, registered_by")
    .eq("id", shiftId)
    .eq("driver_id", driverProfileId)
    .single();

  if (findError || !existing) {
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

  const { weekStart, weekEnd } = getWeekMondaySundayFromDateStr(existing.date);
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

  const { data: deletedRows, error: deleteError } = await supabase
    .from("driver_shifts")
    .delete()
    .eq("driver_id", driverProfileId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .eq("status", "Requested")
    .select("id");

  if (deleteError) {
    console.error("cancelDriverShiftRequest error:", deleteError);
    throw deleteError;
  }
  return { deletedCount: (deletedRows || []).length, weekStart, weekEnd };
};

const bulkApproveDriverShiftsInRange = async (driverProfileId, startDate, endDate, reviewerId) => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("driver_shifts")
    .update({
      status: "Approved",
      reviewed_by: reviewerId,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("driver_id", driverProfileId)
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("status", "Requested")
    .select();

  if (error) {
    console.error("bulkApproveDriverShiftsInRange error:", error);
    throw error;
  }
  return data || [];
};

const getSystemSettingValue = async (key) => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("getSystemSettingValue error:", error);
    return null;
  }
  return data ? data.value : null;
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

