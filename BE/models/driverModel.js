const crypto = require("crypto");
const supabase = require("../config/supabase");
const shiftModel = require("./shiftModel");
const notificationModel = require("./notificationModel");

const ensureUUID = (val) => {
  if (!val) return crypto.randomUUID();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  )
    return val;
  const hash = crypto.createHash("md5").update(String(val)).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

// ==========================================
// 1. PROFILE & DRIVER IDENTITY
// ==========================================

const getDriverProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select(
      `
      id,
      user_account_id,
      license_number,
      license_class,
      license_expiry,
      status,
      last_trip_ended_at,
      user:users!driver_profiles_user_account_id_fkey(id, username, full_name, phone, email, status)
    `,
    )
    .eq("user_account_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getDriverProfileByUserId error:", error);
    throw error;
  }
  return data || null;
};

const getDriverProfileById = async (driverProfileId) => {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select(
      `
      id,
      user_account_id,
      license_number,
      license_class,
      license_expiry,
      status,
      last_trip_ended_at,
      user:users!driver_profiles_user_account_id_fkey(id, username, full_name, phone, email, status)
    `,
    )
    .eq("id", driverProfileId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getDriverProfileById error:", error);
    throw error;
  }
  return data || null;
};

// ==========================================
// 2. TRIP QUERIES (ACTIVE & HISTORY)
// ==========================================

const getActiveTrip = async (driverProfileId) => {
  // 1. Tìm chuyến xe đang hoạt động được gán cho tài xế này trong trip_drivers
  const { data: assignments, error: assignErr } = await supabase
    .from("trip_drivers")
    .select("trip_id, driver_role, assignment_type")
    .eq("driver_id", driverProfileId)
    .is("released_time", null)
    .order("id", { ascending: false });

  if (assignErr) {
    console.error("getActiveTrip assignErr:", assignErr);
    throw assignErr;
  }

  if (!assignments || assignments.length === 0) {
    return null;
  }

  const tripIds = assignments.map((a) => a.trip_id);

  // 2. Lấy thông tin chuyến xe chưa kết thúc
  const { data: trips, error: tripErr } = await supabase
    .from("trips")
    .select(
      `
      id,
      trip_code,
      planned_start,
      planned_distance,
      planned_duration,
      actual_distance,
      actual_duration,
      status,
      created_by,
      created_at,
      truck_assignments:trip_trucks(
        truck_id,
        assignment_type,
        truck:trucks(
          id,
          plate_number,
          model,
          allowed_payload,
          box_length,
          box_width,
          box_height,
          status
        )
      ),
      stops:trip_stops(
        id,
        trip_id,
        order_id,
        sequence,
        stop_type,
        location_id,
        planned_arrival,
        actual_arrival,
        distance_from_previous_stop,
        loaded_quantity,
        loaded_weight,
        delivered_quantity,
        delivered_weight,
        status,
        location:locations(
          id,
          name,
          address,
          latitude,
          longitude,
          contact_name,
          contact_phone,
          geofence_radius
        ),
        order:orders(
          id,
          order_code,
          order_type,
          customer_id,
          agreed_price,
          status,
          receiver_name,
          receiver_phone,
          cargos:order_cargos(*)
        )
      )
    `,
    )
    .in("id", tripIds)
    .in("status", ["Assigned", "Dispatched", "Accepted", "In Progress"])
    .order("id", { ascending: false })
    .limit(1);

  if (tripErr) {
    console.error("getActiveTrip tripErr:", tripErr);
    throw tripErr;
  }

  const activeTrip = trips && trips.length > 0 ? trips[0] : null;
  if (activeTrip) {
    // Sắp xếp các điểm dừng theo thứ tự di chuyển sequence
    if (activeTrip.stops) {
      activeTrip.stops.sort((a, b) => a.sequence - b.sequence);
    }
    // Trích xuất xe đang gán hoạt động
    const activeTruckAssign =
      (activeTrip.truck_assignments || []).find((ta) => ta.truck) ||
      activeTrip.truck_assignments?.[0];
    activeTrip.truck = activeTruckAssign ? activeTruckAssign.truck : null;
  }

  return activeTrip;
};

const getTripHistory = async (driverProfileId, { page = 1, limit = 10 }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Lấy các trip_id tài xế từng phụ trách
  const { data: assignments, error: assignErr } = await supabase
    .from("trip_drivers")
    .select("trip_id")
    .eq("driver_id", driverProfileId);

  if (assignErr) throw assignErr;
  if (!assignments || assignments.length === 0) {
    return { trips: [], total: 0, page, limit };
  }

  const tripIds = [...new Set(assignments.map((a) => a.trip_id))];

  const { data, count, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      trip_code,
      planned_start,
      actual_distance,
      actual_duration,
      status,
      created_at,
      truck_assignments:trip_trucks(
        truck:trucks(plate_number, allowed_payload)
      ),
      stops:trip_stops(
        id,
        sequence,
        stop_type,
        status,
        location:locations(name, address)
      )
    `,
      { count: "exact" },
    )
    .in("id", tripIds)
    .in("status", ["Completed", "Cancelled"])
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("getTripHistory error:", error);
    throw error;
  }

  return {
    trips: data || [],
    total: count || 0,
    page,
    limit,
  };
};

const getTripDetail = async (tripId, driverProfileId) => {
  // Xác minh quyền phụ trách chuyến xe
  const { data: assign, error: checkErr } = await supabase
    .from("trip_drivers")
    .select("trip_id, driver_role")
    .eq("trip_id", tripId)
    .eq("driver_id", driverProfileId)
    .limit(1);

  if (checkErr || !assign || assign.length === 0) {
    return null;
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      trip_code,
      planned_start,
      planned_distance,
      planned_duration,
      actual_distance,
      actual_duration,
      status,
      created_by,
      created_at,
      truck_assignments:trip_trucks(
        truck_id,
        truck:trucks(
          id,
          plate_number,
          model,
          allowed_payload,
          status
        )
      ),
      stops:trip_stops(
        id,
        trip_id,
        order_id,
        sequence,
        stop_type,
        location_id,
        planned_arrival,
        actual_arrival,
        distance_from_previous_stop,
        loaded_quantity,
        loaded_weight,
        delivered_quantity,
        delivered_weight,
        status,
        location:locations(
          id,
          name,
          address,
          latitude,
          longitude,
          contact_name,
          contact_phone,
          geofence_radius
        ),
        order:orders(
          id,
          order_code,
          order_type,
          customer_id,
          agreed_price,
          status,
          receiver_name,
          receiver_phone,
          cargos:order_cargos(*)
        )
      )
    `,
    )
    .eq("id", tripId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getTripDetail error:", error);
    throw error;
  }

  if (trip) {
    if (trip.stops) {
      trip.stops.sort((a, b) => a.sequence - b.sequence);
    }
    const truckAssign =
      (trip.truck_assignments || []).find((ta) => ta.truck) ||
      trip.truck_assignments?.[0];
    trip.truck = truckAssign ? truckAssign.truck : null;
  }

  return trip || null;
};

// ==========================================
// 3. TRIP & STOP MUTATIONS
// ==========================================

const updateTripStatus = async (tripId, status, extraFields = {}) => {
  const payload = {
    status,
    ...extraFields,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("trips")
    .update(payload)
    .eq("id", tripId)
    .select();

  if (error) {
    console.error("updateTripStatus error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

const getTripStopById = async (stopId, tripId) => {
  const { data, error } = await supabase
    .from("trip_stops")
    .select(
      `
      id,
      trip_id,
      order_id,
      sequence,
      stop_type,
      location_id,
      planned_arrival,
      actual_arrival,
      loaded_quantity,
      loaded_weight,
      delivered_quantity,
      delivered_weight,
      status,
      location:locations(
        id,
        name,
        address,
        latitude,
        longitude,
        geofence_radius
      ),
      order:orders(
        id,
        order_code,
        status
      )
    `,
    )
    .eq("id", stopId)
    .eq("trip_id", tripId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getTripStopById error:", error);
    throw error;
  }
  return data || null;
};

const updateTripStop = async (stopId, updateData) => {
  const { data, error } = await supabase
    .from("trip_stops")
    .update(updateData)
    .eq("id", stopId)
    .select();

  if (error) {
    console.error("updateTripStop error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

const updateOrdersStatus = async (
  orderIds,
  status,
  notes = "",
  changedBy = null,
) => {
  if (!orderIds || orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", orderIds)
    .select("id, status");

  if (error) {
    console.error("updateOrdersStatus error:", error);
    throw error;
  }

  // Ghi lịch sử trạng thái đơn hàng (order_status_history)
  const historyInserts = orderIds.map((orderId) => ({
    order_id: orderId,
    to_status: status,
    notes,
    changed_by: changedBy,
  }));

  try {
    await supabase.from("order_status_history").insert(historyInserts);
  } catch (histErr) {
    console.warn("order_status_history insert warning:", histErr.message);
  }

  return data || [];
};

// ==========================================
// 4. FLEET & DRIVER STATUS MUTATIONS
// ==========================================

const updateTruckStatus = async (truckId, status) => {
  if (!truckId) return null;
  const { data, error } = await supabase
    .from("trucks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", truckId)
    .select();

  if (error) console.error("updateTruckStatus error:", error);
  return data;
};

const updateDriverProfileStatus = async (
  driverProfileId,
  status,
  lastTripEndedAt = null,
) => {
  if (!driverProfileId) return null;
  const updatePayload = { status, updated_at: new Date().toISOString() };
  if (lastTripEndedAt) updatePayload.last_trip_ended_at = lastTripEndedAt;

  const { data, error } = await supabase
    .from("driver_profiles")
    .update(updatePayload)
    .eq("id", driverProfileId)
    .select();

  if (error) console.error("updateDriverProfileStatus error:", error);
  return data;
};

// ==========================================
// 5. TRIP EVENTS & DELIVERY EVIDENCE (BR-11, BR-12, BR-27)
// ==========================================

const recordTripEvent = async ({
  clientActionId,
  tripId,
  tripStopId = null,
  driverId = null,
  eventType,
  phoneTime,
  latitude = null,
  longitude = null,
  outsideRadiusFlag = false,
  payload = null,
}) => {
  const insertPayload = {
    client_action_id: ensureUUID(clientActionId),
    trip_id: tripId,
    trip_stop_id: tripStopId,
    driver_id: driverId,
    event_type: eventType,
    phone_time: phoneTime || new Date().toISOString(),
    received_time: new Date().toISOString(),
    latitude,
    longitude,
    outside_radius_flag: !!outsideRadiusFlag,
    payload,
  };

  const { data, error } = await supabase
    .from("trip_events")
    .insert([insertPayload])
    .select();

  if (error) {
    console.error("recordTripEvent error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

// ==========================================
// 6. INCIDENTS (BF-04 & UC-32)
// ==========================================

const createIncident = async ({
  tripId,
  tripStopId = null,
  reportedBy,
  type = "Other",
  description,
  photos = null,
}) => {
  const payload = {
    trip_id: tripId,
    trip_stop_id: tripStopId,
    reported_by: reportedBy,
    type,
    status: "Reported",
    description,
    photos: Array.isArray(photos)
      ? photos
      : typeof photos === "string" && photos.trim()
        ? [photos]
        : null,
    reported_time: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("incidents")
    .insert([payload])
    .select();

  if (error) {
    console.error("createIncident error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

// ==========================================
// 7. IDEMPOTENCY & AUDIT LOGS (BR-27)
// ==========================================

const checkIdempotency = async (clientActionId) => {
  if (!clientActionId) return false;
  const uuid = ensureUUID(clientActionId);

  // Kiểm tra trong bảng trip_events
  const { data, error } = await supabase
    .from("trip_events")
    .select("id")
    .eq("client_action_id", uuid)
    .limit(1);

  if (error) return false;
  return data && data.length > 0;
};

const logDriverActivity = async ({
  actorId,
  actorType = "DRIVER",
  action,
  targetType = "TRIP",
  targetId = 0,
  reason = null,
  changes = null,
  clientActionId = null,
}) => {
  try {
    await supabase.from("activity_logs").insert([
      {
        actor_id: actorId,
        actor_type: actorType,
        action,
        target_type: targetType,
        target_id:
          typeof targetId === "number" ? targetId : parseInt(targetId) || 0,
        reason,
        changes: changes ? JSON.stringify(changes) : null,
        created_time: new Date().toISOString(),
        client_action_id: clientActionId,
      },
    ]);
  } catch (err) {
    console.warn("logDriverActivity insert warning:", err.message);
  }
};

// ==========================================
// 8. DRIVER SHIFTS (UC-20, BR-60) -> Tách sang ./shiftModel.js
// ==========================================

// ==========================================
// 9. CUSTOMER REFUSAL (BR-57)
// ==========================================

const updateOrderRefusal = async (
  orderId,
  { reason, photoUrl, changedBy = null },
) => {
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "Delivered (Exception)",
      refusal_reason: reason,
      refusal_photo: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, order_code, status, refusal_reason, refusal_photo");

  if (error) {
    console.error("updateOrderRefusal error:", error);
    throw error;
  }

  // Ghi nhận lịch sử đơn hàng
  try {
    await supabase.from("order_status_history").insert([
      {
        order_id: orderId,
        to_status: "Delivered (Exception)",
        notes: `Khách từ chối nhận hàng: ${reason}`,
        changed_by: changedBy,
      },
    ]);
  } catch (hErr) {
    console.warn("order_status_history insert warning:", hErr.message);
  }

  return data && data.length > 0 ? data[0] : null;
};

// ==========================================
// 10. EXTRA FEES (BR-30, MSG85)
// ==========================================

const createProposedExtraFee = async ({
  tripId,
  orderId = null,
  feeType,
  amount,
  reason,
  photoUrl,
  recordedBy,
}) => {
  const payload = {
    trip_id: tripId,
    order_id: orderId,
    fee_type: feeType,
    amount: parseInt(amount, 10),
    reason,
    photo_url: photoUrl,
    status: "Proposed",
    source: "Driver",
    suggested_by_system: false,
    recorded_by: recordedBy,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("extra_fees")
    .insert([payload])
    .select();

  if (error) {
    console.error("createProposedExtraFee error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

// ==========================================
// 11. NOTIFICATIONS (Screen 6.5, MSG80, MSG85, MSG75) -> Tách sang ./notificationModel.js
// ==========================================

// ==========================================
// 12. DRIVING HOURS CALCULATION (BR-34)
// ==========================================

const getDriverDrivingTimeStats = async (driverProfileId) => {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();

  // Bắt đầu tuần (Thứ hai)
  const dayOfWeek = now.getDay(); // 0 is Sunday
  const diffToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diffToMonday,
  ).toISOString();

  // 1. Tính tổng thời gian các chuyến xe đã hoàn thành trong ngày & tuần
  const { data: assignments } = await supabase
    .from("trip_drivers")
    .select("trip_id")
    .eq("driver_id", driverProfileId);

  const tripIds = (assignments || []).map((a) => a.trip_id);

  let todayDrivenMinutes = 0;
  let weekDrivenMinutes = 0;
  let continuousMinutes = 0;

  if (tripIds.length > 0) {
    const { data: recentTrips } = await supabase
      .from("trips")
      .select(
        "id, actual_duration, status, planned_start, created_at, updated_at",
      )
      .in("id", tripIds)
      .gte("created_at", startOfWeek);

    for (const t of recentTrips || []) {
      const dur = t.actual_duration || 0; // phút
      const tripTime = new Date(t.created_at).getTime();

      if (tripTime >= new Date(startOfDay).getTime()) {
        todayDrivenMinutes += dur;
      }
      weekDrivenMinutes += dur;
    }
  }

  // 2. Tính thời gian lái của chuyến In Progress hiện tại (nếu có)
  const activeTrip = await getActiveTrip(driverProfileId);
  if (activeTrip && activeTrip.status === "In Progress") {
    // Tìm sự kiện Arrived đầu tiên
    const firstStopArrive = (activeTrip.stops || []).find(
      (s) => s.actual_arrival,
    );
    if (firstStopArrive && firstStopArrive.actual_arrival) {
      const startedAt = new Date(firstStopArrive.actual_arrival).getTime();
      const currentActiveMin = Math.max(
        0,
        Math.round((now.getTime() - startedAt) / 60000),
      );
      continuousMinutes = currentActiveMin;
      todayDrivenMinutes += currentActiveMin;
      weekDrivenMinutes += currentActiveMin;
    }
  }

  const continuousHours = Math.round((continuousMinutes / 60) * 10) / 10;
  const todayHours = Math.round((todayDrivenMinutes / 60) * 10) / 10;
  const weekHours = Math.round((weekDrivenMinutes / 60) * 10) / 10;

  return {
    continuous_hours_driven: continuousHours,
    continuous_hours_left: Math.max(
      0,
      Math.round((4.0 - continuousHours) * 10) / 10,
    ),
    continuous_limit: 4.0,

    daily_hours_driven: todayHours,
    daily_hours_left: Math.max(0, Math.round((10.0 - todayHours) * 10) / 10),
    daily_limit: 10.0,

    weekly_hours_driven: weekHours,
    weekly_hours_left: Math.max(0, Math.round((48.0 - weekHours) * 10) / 10),
    weekly_limit: 48.0,
  };
};

module.exports = {
  getDriverProfileByUserId,
  getDriverProfileById,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  updateTripStatus,
  getTripStopById,
  updateTripStop,
  updateOrdersStatus,
  updateTruckStatus,
  updateDriverProfileStatus,
  recordTripEvent,
  createIncident,
  checkIdempotency,
  logDriverActivity,
  updateOrderRefusal,
  createProposedExtraFee,
  getDriverDrivingTimeStats,

  // Re-export từ shiftModel & notificationModel để giữ tương thích ngược 100%
  ...shiftModel,
  ...notificationModel,
};
