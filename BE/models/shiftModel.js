const supabase = require("../config/supabase");

// ==========================================
// DRIVER SHIFTS (UC-20, Screen 25, BR-08, BR-34, BR-60)
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
  return data && data.length > 0 ? data[0] : null;
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

const cancelDriverShiftRequest = async (shiftId, driverProfileId) => {
  const { data: existing, error: findError } = await supabase
    .from("driver_shifts")
    .select("id, status, driver_id")
    .eq("id", shiftId)
    .eq("driver_id", driverProfileId)
    .single();

  if (findError || !existing) {
    throw new Error("Không tìm thấy ca làm việc hoặc bạn không có quyền hủy.");
  }

  if (existing.status !== "Requested") {
    throw new Error("Chỉ có thể hủy ca làm việc đang ở trạng thái Chờ duyệt.");
  }

  const { error: deleteError } = await supabase
    .from("driver_shifts")
    .delete()
    .eq("id", shiftId);

  if (deleteError) {
    console.error("cancelDriverShiftRequest error:", deleteError);
    throw deleteError;
  }
  return true;
};

module.exports = {
  getDriverShifts,
  checkShiftOverlap,
  createDriverShift,
  getShiftsWithDriverInfo,
  getShiftById,
  insertShiftRecord,
  updateDriverShift,
  deleteDriverShift,
  calculateDriverDailyHours,
  cancelDriverShiftRequest,
};

