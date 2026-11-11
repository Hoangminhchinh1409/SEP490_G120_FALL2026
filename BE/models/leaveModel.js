const supabase = require("../config/supabase");
const notificationModel = require("./notificationModel");

const GMT7_OFFSET_MS = 7 * 3600 * 1000;
const ACTIVE_TRIP_STATUSES = ["Assigned", "Dispatched", "Accepted", "In Progress"];
const LEAVE_LOG_ACTION = "DRIVER_LEAVE_REQUEST";
const LEAVE_TARGET_TYPE = "DRIVER_LEAVE";

const getTodayGMT7Str = () => {
  return new Date(Date.now() + GMT7_OFFSET_MS).toISOString().split("T")[0];
};

const toGMT7DateStr = (isoTimestamp) => {
  if (!isoTimestamp) return null;
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getTime() + GMT7_OFFSET_MS).toISOString().split("T")[0];
};

const parseChangesJson = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const formatRouteFromStops = (stops = []) => {
  const sorted = [...(stops || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const firstLoc = sorted[0]?.location?.name || sorted[0]?.location?.address || null;
  const lastLoc =
    sorted.length > 1
      ? sorted[sorted.length - 1]?.location?.name || sorted[sorted.length - 1]?.location?.address || null
      : null;

  if (firstLoc && lastLoc) return `${firstLoc} -> ${lastLoc}`;
  if (firstLoc) return firstLoc;
  return sorted.length > 0 ? `${sorted.length} điểm dừng` : "Chưa có điểm dừng";
};

/**
 * Lấy danh sách chuyến xe đang hoạt động/đã giao cho tài xế trong các ngày được chọn (GMT+7).
 */
const getDriverAffectedTripsByDates = async (driverProfileId, dates = []) => {
  const targetSet = new Set((dates || []).map((d) => String(d).trim()).filter(Boolean));
  if (!driverProfileId || targetSet.size === 0) return [];

  const { data: assignments, error: assignErr } = await supabase
    .from("trip_drivers")
    .select("trip_id")
    .eq("driver_id", driverProfileId)
    .is("released_time", null);

  if (assignErr) throw assignErr;
  if (!assignments || assignments.length === 0) return [];

  const tripIds = [...new Set(assignments.map((a) => a.trip_id))];
  const { data: trips, error: tripErr } = await supabase
    .from("trips")
    .select(`
      id,
      trip_code,
      planned_start,
      status,
      created_at,
      truck_assignments:trip_trucks(
        released_time,
        truck:trucks(plate_number, model)
      ),
      stops:trip_stops(
        id,
        sequence,
        stop_type,
        location:locations(name, address)
      )
    `)
    .in("id", tripIds)
    .in("status", ACTIVE_TRIP_STATUSES)
    .order("planned_start", { ascending: true });

  if (tripErr) throw tripErr;

  return (trips || [])
    .filter((t) => {
      const dateStr = toGMT7DateStr(t.planned_start || t.created_at);
      return dateStr && targetSet.has(dateStr);
    })
    .map((t) => {
      const activeTruck =
        (t.truck_assignments || []).find((ta) => !ta.released_time && ta.truck) ||
        t.truck_assignments?.[0] ||
        null;
      return {
        trip_id: Number(t.id),
        trip_code: t.trip_code || `TRIP-${t.id}`,
        planned_start: t.planned_start,
        planned_date: toGMT7DateStr(t.planned_start || t.created_at),
        status: t.status,
        plate_number: activeTruck?.truck?.plate_number || null,
        route_summary: formatRouteFromStops(t.stops),
        reassigned: false,
        reassigned_to_driver_id: null,
        reassigned_to_driver_name: null,
        reassigned_at: null,
      };
    });
};

const createLeaveRequest = async ({ userId, driverProfileId, dates, reason, affectedTrips = [] }) => {
  const cleanReason = String(reason || "").trim();
  const payloadChanges = {
    leave_dates: dates,
    reason: cleanReason,
    status: "PENDING",
    affected_trips: affectedTrips,
    manager_comment: null,
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
  };

  const { data, error } = await supabase
    .from("activity_logs")
    .insert([
      {
        actor_id: userId,
        actor_type: "DRIVER",
        action: LEAVE_LOG_ACTION,
        target_type: LEAVE_TARGET_TYPE,
        target_id: driverProfileId,
        reason: cleanReason.slice(0, 250),
        changes: payloadChanges,
        created_time: new Date().toISOString(),
      },
    ])
    .select();

  if (error) throw error;
  const row = data && data[0] ? data[0] : null;
  return row ? formatLeaveRow(row, {}) : null;
};

const formatLeaveRow = (row, driverMap = {}, activeTripDriverMap = new Map()) => {
  const changes = parseChangesJson(row.changes);
  const driverProf = driverMap[Number(row.target_id)] || null;
  const leaveStatus = String(changes.status || "PENDING").toUpperCase();

  const enrichedTrips = (changes.affected_trips || []).map((tr) => {
    const activeDriver = activeTripDriverMap.get(Number(tr.trip_id));
    if (leaveStatus === "APPROVED" && activeDriver && Number(activeDriver.driver_id) !== Number(row.target_id)) {
      return {
        ...tr,
        reassigned: true,
        reassigned_to_driver_id: Number(activeDriver.driver_id),
        reassigned_to_driver_name: activeDriver.driver_name || tr.reassigned_to_driver_name || "Tài xế thay thế",
      };
    }
    return tr;
  });

  return {
    id: Number(row.id),
    driver_id: Number(row.target_id),
    driver_user_id: row.actor_id ? Number(row.actor_id) : driverProf?.user_account_id || null,
    driver_name: driverProf?.user?.full_name || driverProf?.user?.username || `Tài xế #${row.target_id}`,
    driver_phone: driverProf?.user?.phone || "",
    license_class: driverProf?.license_class || "",
    leave_dates: Array.isArray(changes.leave_dates) ? changes.leave_dates : [],
    reason: changes.reason || row.reason || "",
    status: leaveStatus,
    affected_trips: enrichedTrips,
    manager_comment: changes.manager_comment || null,
    reviewed_by: changes.reviewed_by || null,
    reviewed_by_name: changes.reviewed_by_name || null,
    reviewed_at: changes.reviewed_at || null,
    created_at: row.created_time,
  };
};

const getLeaveRequests = async ({ driverProfileId = null, status = null } = {}) => {
  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, actor_type, action, target_type, target_id, changes, reason, created_time")
    .eq("action", LEAVE_LOG_ACTION)
    .order("id", { ascending: false });

  if (driverProfileId) {
    query = query.eq("target_id", driverProfileId);
  }

  const { data: logs, error } = await query;
  if (error) throw error;
  if (!logs || logs.length === 0) return [];

  const driverIds = [...new Set(logs.map((l) => l.target_id).filter(Boolean))];
  const driverMap = {};

  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from("driver_profiles")
      .select(`
        id,
        user_account_id,
        license_class,
        user:users!driver_profiles_user_account_id_fkey(id, username, full_name, phone, email)
      `)
      .in("id", driverIds);

    (profiles || []).forEach((p) => {
      driverMap[Number(p.id)] = p;
    });
  }

  // Thu thập tất cả trip_id trong các đơn đã APPROVED để kiểm tra trạng thái đổi tài thực tế
  const approvedTripIds = [];
  logs.forEach((l) => {
    const ch = parseChangesJson(l.changes);
    if (String(ch.status || "").toUpperCase() === "APPROVED") {
      (ch.affected_trips || []).forEach((tr) => {
        if (tr.trip_id) approvedTripIds.push(Number(tr.trip_id));
      });
    }
  });

  const activeTripDriverMap = new Map();
  if (approvedTripIds.length > 0) {
    const { data: currentAssigns } = await supabase
      .from("trip_drivers")
      .select(`
        trip_id,
        driver_id,
        released_time,
        driver_profile:driver_profiles(
          id,
          user:users!driver_profiles_user_account_id_fkey(full_name)
        )
      `)
      .in("trip_id", [...new Set(approvedTripIds)])
      .is("released_time", null);

    (currentAssigns || []).forEach((a) => {
      activeTripDriverMap.set(Number(a.trip_id), {
        driver_id: Number(a.driver_id),
        driver_name: a.driver_profile?.user?.full_name || `Tài xế #${a.driver_id}`,
      });
    });
  }

  const formatted = logs.map((row) => formatLeaveRow(row, driverMap, activeTripDriverMap));
  if (status && status !== "ALL") {
    const targetSt = String(status).toUpperCase();
    return formatted.filter((item) => item.status === targetSt);
  }
  return formatted;
};

const getLeaveRequestById = async (id) => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, actor_id, actor_type, action, target_type, target_id, changes, reason, created_time")
    .eq("id", id)
    .eq("action", LEAVE_LOG_ACTION)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: prof } = await supabase
    .from("driver_profiles")
    .select(`
      id,
      user_account_id,
      license_class,
      user:users!driver_profiles_user_account_id_fkey(id, username, full_name, phone, email)
    `)
    .eq("id", data.target_id)
    .maybeSingle();

  const driverMap = prof ? { [Number(prof.id)]: prof } : {};
  return {
    raw: data,
    formatted: formatLeaveRow(data, driverMap),
  };
};

const updateLeaveRequestChanges = async (id, changesObj) => {
  const { data, error } = await supabase
    .from("activity_logs")
    .update({ changes: changesObj })
    .eq("id", id)
    .eq("action", LEAVE_LOG_ACTION)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

const markDriverShiftsOnDatesAsLeaveApproved = async (driverProfileId, dates = [], reason = "", reviewerId = null) => {
  if (!driverProfileId || !dates || dates.length === 0) return 0;

  const { data: existingShifts, error: findErr } = await supabase
    .from("driver_shifts")
    .select("id, date, status")
    .eq("driver_id", driverProfileId)
    .in("date", dates)
    .in("status", ["Requested", "Approved"]);

  if (findErr) throw findErr;
  if (!existingShifts || existingShifts.length === 0) return 0;

  const shiftIds = existingShifts.map((s) => s.id);
  const nowIso = new Date().toISOString();
  const rejectMsg = `[Đã duyệt nghỉ đột xuất] ${String(reason || "").trim()}`.slice(0, 240);

  const { error: updErr } = await supabase
    .from("driver_shifts")
    .update({
      status: "Rejected",
      rejection_reason: rejectMsg,
      reviewed_by: reviewerId,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .in("id", shiftIds);

  if (updErr) throw updErr;
  return shiftIds.length;
};

const releaseDriverFromTripsOnApproval = async (driverProfileId, tripIds = [], reason = "") => {
  if (!driverProfileId || !tripIds || tripIds.length === 0) return [];

  const { data: activeRows, error: findErr } = await supabase
    .from("trip_drivers")
    .select("id, trip_id")
    .eq("driver_id", driverProfileId)
    .in("trip_id", tripIds)
    .is("released_time", null);

  if (findErr) throw findErr;
  if (!activeRows || activeRows.length === 0) return [];

  const nowIso = new Date().toISOString();
  const reasonMsg = `[Nghỉ đột xuất đã duyệt] ${String(reason || "").trim()}`.slice(0, 250);
  const rowIds = activeRows.map((r) => r.id);

  const { error: updErr } = await supabase
    .from("trip_drivers")
    .update({
      released_time: nowIso,
      replacement_reason: reasonMsg,
    })
    .in("id", rowIds);

  if (updErr) throw updErr;

  // Đặt lại trạng thái tài xế về Active nếu đang kẹt On Trip
  const { data: prof } = await supabase
    .from("driver_profiles")
    .select("id, status")
    .eq("id", driverProfileId)
    .maybeSingle();

  if (prof && String(prof.status || "").toUpperCase() === "ON_TRIP") {
    await supabase
      .from("driver_profiles")
      .update({ status: "Active", updated_at: nowIso })
      .eq("id", driverProfileId);
  }

  return [...new Set(activeRows.map((r) => Number(r.trip_id)))];
};

const getActiveUsersByRoles = async (roleIds = []) => {
  if (!roleIds || roleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role_id, status")
    .in("role_id", roleIds)
    .ilike("status", "active");

  if (error) throw error;
  return data || [];
};

const getUserDisplayName = async (userId) => {
  if (!userId) return null;
  const { data } = await supabase
    .from("users")
    .select("full_name, username")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || data?.username || null;
};

/**
 * Dispatcher: Lấy danh sách chuyến xe đang cần đổi tài xế (do tài xế nghỉ đột xuất đã duyệt)
 * và danh sách tài xế nội bộ khả dụng kèm lịch ca làm việc theo ngày chạy chuyến.
 */
const getReassignmentsNeededForDispatcher = async () => {
  const approvedLeaves = await getLeaveRequests({ status: "APPROVED" });

  // Thu thập tất cả trip từ các đơn nghỉ đã duyệt
  const leaveByTripId = new Map();
  approvedLeaves.forEach((lr) => {
    (lr.affected_trips || []).forEach((tr) => {
      if (!leaveByTripId.has(Number(tr.trip_id))) {
        leaveByTripId.set(Number(tr.trip_id), {
          leave_request_id: lr.id,
          leaving_driver_id: lr.driver_id,
          leaving_driver_name: lr.driver_name,
          leaving_driver_phone: lr.driver_phone,
          leave_dates: lr.leave_dates,
          leave_reason: lr.reason,
          reviewed_at: lr.reviewed_at,
        });
      }
    });
  });

  // Tìm cả những chuyến active không có tài xế đang giữ (released_time IS NULL)
  const { data: activeTrips, error: tripErr } = await supabase
    .from("trips")
    .select(`
      id,
      trip_code,
      planned_start,
      planned_duration,
      planned_distance,
      status,
      created_at,
      truck_assignments:trip_trucks(
        released_time,
        truck:trucks(id, plate_number, model, allowed_payload, required_license_class)
      ),
      driver_assignments:trip_drivers(
        id,
        driver_id,
        driver_role,
        assignment_type,
        assigned_time,
        released_time,
        replacement_reason,
        driver_profile:driver_profiles(
          id,
          license_class,
          user:users!driver_profiles_user_account_id_fkey(id, full_name, phone)
        )
      ),
      stops:trip_stops(
        id,
        sequence,
        stop_type,
        location:locations(name, address)
      )
    `)
    .in("status", ACTIVE_TRIP_STATUSES)
    .order("planned_start", { ascending: true });

  if (tripErr) throw tripErr;

  const pendingReassignments = [];
  (activeTrips || []).forEach((t) => {
    const assigns = t.driver_assignments || [];
    const hasActiveDriver = assigns.some((a) => !a.released_time);
    const leaveMeta = leaveByTripId.get(Number(t.id)) || null;

    if (!hasActiveDriver) {
      const sortedReleased = [...assigns]
        .filter((a) => a.released_time)
        .sort((a, b) => new Date(b.released_time) - new Date(a.released_time));
      const latestReleased = sortedReleased[0] || null;
      const activeTruck =
        (t.truck_assignments || []).find((ta) => !ta.released_time && ta.truck) ||
        t.truck_assignments?.[0] ||
        null;

      pendingReassignments.push({
        trip_id: Number(t.id),
        trip_code: t.trip_code || `TRIP-${t.id}`,
        planned_start: t.planned_start,
        planned_date: toGMT7DateStr(t.planned_start || t.created_at),
        planned_duration: t.planned_duration,
        planned_distance: t.planned_distance,
        status: t.status,
        plate_number: activeTruck?.truck?.plate_number || "Chưa rõ biển số",
        truck_model: activeTruck?.truck?.model || "Xe tải",
        required_license_class: activeTruck?.truck?.required_license_class || null,
        route_summary: formatRouteFromStops(t.stops),
        leave_request_id: leaveMeta?.leave_request_id || null,
        leaving_driver_id:
          leaveMeta?.leaving_driver_id || (latestReleased ? Number(latestReleased.driver_id) : null),
        leaving_driver_name:
          leaveMeta?.leaving_driver_name ||
          latestReleased?.driver_profile?.user?.full_name ||
          "Tài xế trước",
        leaving_driver_phone:
          leaveMeta?.leaving_driver_phone || latestReleased?.driver_profile?.user?.phone || "",
        leave_reason:
          leaveMeta?.leave_reason ||
          latestReleased?.replacement_reason ||
          "Nghỉ đột xuất đã được Quản lý duyệt",
        reassigned: false,
      });
    }
  });

  // Lấy toàn bộ tài xế nội bộ + ca làm từ hôm nay trở đi để Dispatcher chọn thay thế chính xác
  const todayStr = getTodayGMT7Str();
  const [{ data: allDrivers }, { data: upcomingShifts }, { data: busyAssignments }] = await Promise.all([
    supabase
      .from("driver_profiles")
      .select(`
        id,
        user_account_id,
        license_class,
        license_expiry,
        status,
        user:users!driver_profiles_user_account_id_fkey(id, full_name, phone, status)
      `)
      .order("id", { ascending: true }),
    supabase
      .from("driver_shifts")
      .select("id, driver_id, date, start_time, end_time, status")
      .gte("date", todayStr)
      .neq("status", "Rejected"),
    supabase
      .from("trip_drivers")
      .select(`
        driver_id,
        trip:trips(id, trip_code, planned_start, status)
      `)
      .is("released_time", null),
  ]);

  const shiftsByDriver = new Map();
  (upcomingShifts || []).forEach((s) => {
    const key = Number(s.driver_id);
    if (!shiftsByDriver.has(key)) shiftsByDriver.set(key, []);
    shiftsByDriver.get(key).push({
      date: s.date,
      status: s.status,
      start_time: s.start_time,
      end_time: s.end_time,
    });
  });

  const activeTripCountByDriver = new Map();
  (busyAssignments || []).forEach((b) => {
    if (b.trip && ACTIVE_TRIP_STATUSES.includes(b.trip.status)) {
      const key = Number(b.driver_id);
      activeTripCountByDriver.set(key, (activeTripCountByDriver.get(key) || 0) + 1);
    }
  });

  const availableDrivers = (allDrivers || [])
    .filter((d) => String(d.user?.status || "").toUpperCase() === "ACTIVE")
    .map((d) => ({
      id: Number(d.id),
      user_account_id: Number(d.user_account_id),
      full_name: d.user?.full_name || `Tài xế #${d.id}`,
      phone: d.user?.phone || "",
      license_class: d.license_class || "C",
      license_expiry: d.license_expiry,
      status: d.status,
      active_trips_count: activeTripCountByDriver.get(Number(d.id)) || 0,
      shifts: shiftsByDriver.get(Number(d.id)) || [],
    }));

  return {
    reassignments: pendingReassignments,
    availableDrivers,
  };
};

/**
 * Dispatcher: Gán tài xế thay thế mới cho chuyến xe (do nghỉ đột xuất / đổi tài).
 */
const reassignDriverOnTrip = async ({ tripId, newDriverId, dispatcherUserId, reason = "" }) => {
  const numTripId = Number(tripId);
  const numDriverId = Number(newDriverId);
  if (!numTripId || !numDriverId) {
    const err = new Error("Thiếu mã chuyến xe hoặc tài xế thay thế hợp lệ.");
    err.statusCode = 400;
    throw err;
  }

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select(`
      id,
      trip_code,
      planned_start,
      status,
      truck_assignments:trip_trucks(
        released_time,
        truck:trucks(plate_number)
      )
    `)
    .eq("id", numTripId)
    .maybeSingle();

  if (tripErr) throw tripErr;
  if (!trip) {
    const err = new Error("Không tìm thấy chuyến xe cần đổi tài xế.");
    err.statusCode = 404;
    throw err;
  }
  if (trip.status === "Completed" || trip.status === "Cancelled") {
    const err = new Error("Chuyến xe đã hoàn thành hoặc đã hủy, không thể đổi tài xế.");
    err.statusCode = 400;
    throw err;
  }

  const { data: newDriver, error: drvErr } = await supabase
    .from("driver_profiles")
    .select(`
      id,
      user_account_id,
      license_class,
      user:users!driver_profiles_user_account_id_fkey(id, full_name, phone, status)
    `)
    .eq("id", numDriverId)
    .maybeSingle();

  if (drvErr) throw drvErr;
  if (!newDriver) {
    const err = new Error("Không tìm thấy hồ sơ tài xế thay thế.");
    err.statusCode = 404;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const cleanReason =
    String(reason || "Điều phối viên đổi tài xế thay thế do nghỉ đột xuất").trim().slice(0, 250);

  // 1. Giải phóng tài xế cũ nếu vẫn còn dòng unreleased
  const { data: oldAssigns } = await supabase
    .from("trip_drivers")
    .select("id")
    .eq("trip_id", numTripId)
    .is("released_time", null);

  if (oldAssigns && oldAssigns.length > 0) {
    await supabase
      .from("trip_drivers")
      .update({ released_time: nowIso, replacement_reason: cleanReason })
      .in("id", oldAssigns.map((o) => o.id));
  }

  // 2. Tạo phân công tài xế mới
  const { error: insErr } = await supabase.from("trip_drivers").insert([
    {
      trip_id: numTripId,
      driver_id: numDriverId,
      driver_role: "Primary",
      assignment_type: "Replacement",
      assigned_time: nowIso,
      replacement_reason: cleanReason,
    },
  ]);
  if (insErr) throw insErr;

  // 3. Cập nhật timestamp trên bảng trips
  await supabase.from("trips").update({ updated_at: nowIso }).eq("id", numTripId);

  // 4. Đánh dấu đã re-assign trong các đơn nghỉ APPROVED có chứa trip_id này
  const newDriverName = newDriver.user?.full_name || `Tài xế #${numDriverId}`;
  const { data: leaveLogs } = await supabase
    .from("activity_logs")
    .select("id, changes")
    .eq("action", LEAVE_LOG_ACTION);

  for (const log of leaveLogs || []) {
    const ch = parseChangesJson(log.changes);
    if (String(ch.status || "").toUpperCase() !== "APPROVED") continue;
    const tripsArr = Array.isArray(ch.affected_trips) ? ch.affected_trips : [];
    let modified = false;
    const updatedTripsArr = tripsArr.map((tr) => {
      if (Number(tr.trip_id) === numTripId) {
        modified = true;
        return {
          ...tr,
          reassigned: true,
          reassigned_to_driver_id: numDriverId,
          reassigned_to_driver_name: newDriverName,
          reassigned_at: nowIso,
        };
      }
      return tr;
    });
    if (modified) {
      await updateLeaveRequestChanges(log.id, { ...ch, affected_trips: updatedTripsArr });
    }
  }

  // 5. Gửi thông báo cho tài xế thay thế mới
  const activeTruck =
    (trip.truck_assignments || []).find((ta) => !ta.released_time && ta.truck) ||
    trip.truck_assignments?.[0] ||
    null;
  const plate = activeTruck?.truck?.plate_number || "Xe tải";
  const plannedDate = toGMT7DateStr(trip.planned_start) || "";

  if (newDriver.user_account_id) {
    await notificationModel.createSystemNotification({
      userAccountId: newDriver.user_account_id,
      targetType: "TRIP",
      targetId: numTripId,
      message: `Bạn được điều phối thay thế chạy chuyến ${trip.trip_code || `#${numTripId}`} (${plate})${plannedDate ? ` ngày ${plannedDate}` : ""}. Lý do: ${cleanReason}`,
    });
  }

  // 6. Ghi log điều phối đổi tài xế
  await supabase.from("activity_logs").insert([
    {
      actor_id: dispatcherUserId || null,
      actor_type: "DISPATCHER",
      action: "DISPATCHER_REASSIGN_DRIVER",
      target_type: "TRIP",
      target_id: numTripId,
      changes: {
        trip_id: numTripId,
        trip_code: trip.trip_code,
        new_driver_id: numDriverId,
        new_driver_name: newDriverName,
      },
      reason: cleanReason,
      created_time: nowIso,
    },
  ]);

  return {
    trip_id: numTripId,
    trip_code: trip.trip_code || `TRIP-${numTripId}`,
    new_driver_id: numDriverId,
    new_driver_name: newDriverName,
    new_driver_phone: newDriver.user?.phone || "",
    reason: cleanReason,
  };
};

module.exports = {
  getTodayGMT7Str,
  toGMT7DateStr,
  getDriverAffectedTripsByDates,
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequestChanges,
  markDriverShiftsOnDatesAsLeaveApproved,
  releaseDriverFromTripsOnApproval,
  getActiveUsersByRoles,
  getUserDisplayName,
  getReassignmentsNeededForDispatcher,
  reassignDriverOnTrip,
};

