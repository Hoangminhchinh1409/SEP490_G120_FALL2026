const crypto = require("crypto");
const driverModel = require("../models/driverModel");
const leaveModel = require("../models/leaveModel");
const supabase = require("../config/supabase");

// Helper chuẩn hóa điểm lấy hàng (Pickup) hay điểm giao hàng (Drop-off)
const isPickupStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.stop_type || stop.type || "").trim().toUpperCase();
  if (raw === "PICKUP" || raw === "LẤY HÀNG" || raw === "LAY HANG") return true;
  if (
    raw === "DROPOFF" ||
    raw === "DROP-OFF" ||
    raw === "DROP_OFF" ||
    raw === "DELIVERY" ||
    raw === "GIAO HÀNG" ||
    raw === "GIAO HANG" ||
    raw === "REST" ||
    raw === "TRANSIT"
  ) {
    return false;
  }
  return stop.sequence === 1;
};

const isDropoffStop = (stop) => {
  if (!stop) return false;
  return !isPickupStop(stop);
};

// ==========================================
// 1. PROFILE & OVERVIEW
// ==========================================

const getMyProfile = async (userId) => {
  const profile = await driverModel.getDriverProfileByUserId(userId);
  if (!profile) {
    const error = new Error("Tài khoản chưa được liên kết với hồ sơ tài xế");
    error.statusCode = 404;
    throw error;
  }
  const drivingHours = await driverModel.getDriverDrivingTimeStats(profile.id);
  return {
    ...profile,
    drivingHours
  };
};

const getActiveTrip = async (userId) => {
  const profile = await getMyProfile(userId);
  const tripResult = await driverModel.getActiveTrip(profile.id);

  const trip = tripResult?.activeTrip || (tripResult?.id ? tripResult : null);
  const upcomingTrips = tripResult?.upcomingTrips || (trip ? [trip] : []);

  if (!trip && (!upcomingTrips || upcomingTrips.length === 0)) {
    return {
      hasActiveTrip: false,
      message: "Hiện tại bạn chưa có chuyến xe nào được phân công.",
      trip: null,
      upcomingTrips: [],
      drivingHours: profile.drivingHours
    };
  }

  // Xác định điểm dừng kế tiếp cần thực hiện (điểm dừng chưa hoàn thành 'Done')
  let currentStop = null;
  if (trip && trip.stops && trip.stops.length > 0) {
    currentStop = trip.stops.find(s => s.status !== "Done") || trip.stops[trip.stops.length - 1];
  }

  return {
    hasActiveTrip: Boolean(trip),
    trip,
    upcomingTrips,
    currentStop,
    drivingHours: profile.drivingHours
  };
};

const getTripHistory = async (userId, { page = 1, limit = 10 }) => {
  const profile = await getMyProfile(userId);
  return await driverModel.getTripHistory(profile.id, { page, limit });
};

const getTripDetail = async (userId, tripId) => {
  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Không tìm thấy chuyến xe hoặc bạn không có quyền truy cập");
    error.statusCode = 404;
    throw error;
  }
  return trip;
};

// ==========================================
// 2. TRIP WORKFLOW: ACCEPT TRIP
// ==========================================

const acceptTrip = async (userId, tripId, { clientActionId = null, phoneTime = null } = {}) => {
  const actionId = clientActionId || crypto.randomUUID();

  // 1. Kiểm tra tính bất biến Offline Sync
  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó (Idempotent)" };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);

  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại hoặc không thuộc quyền phụ trách");
    error.statusCode = 404;
    throw error;
  }

  // Nếu đã Accept trước đó thì trả về thành công
  if (trip.status === "Accepted" || trip.status === "In Progress") {
    return { success: true, message: "Chuyến xe đã được nhận", trip };
  }

  const updatedTrip = await driverModel.updateTripStatus(tripId, "Accepted");

  // Cập nhật trạng thái các đơn hàng thuộc chuyến xe sang Accepted
  const orderIds = (trip.stops || [])
    .map(s => s.order_id)
    .filter(Boolean);
  const uniqueOrderIds = [...new Set(orderIds)];
  if (uniqueOrderIds.length > 0) {
    await driverModel.updateOrdersStatus(
      uniqueOrderIds,
      "Accepted",
      `Tài xế đã xác nhận nhận chuyến xe ${trip.trip_code}`,
      userId
    );
  }

  // Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    driverId: profile.id,
    eventType: "Accepted",
    phoneTime: phoneTime || new Date().toISOString()
  });

  // Ghi nhật ký vết hệ thống (activity_logs)
  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "ACCEPT_TRIP",
    targetType: "TRIP",
    targetId: tripId,
    reason: `Tài xế ${profile.user?.full_name || userId} đã xác nhận nhận chuyến xe ${trip.trip_code}`,
    changes: { previousStatus: trip.status, newStatus: "Accepted" },
    clientActionId: actionId
  });

  return {
    success: true,
    message: `Đã xác nhận nhận chuyến xe ${trip.trip_code}`,
    trip: updatedTrip
  };
};

// ==========================================
// 3. TRIP WORKFLOW: STOP ARRIVAL
// ==========================================

const arriveAtStop = async (userId, tripId, stopId, { phoneLat = null, phoneLng = null, phoneTime = null, clientActionId = null } = {}) => {
  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop) {
    const error = new Error("Điểm dừng không tồn tại trên chuyến xe này");
    error.statusCode = 404;
    throw error;
  }

  if (stop.status === "Arrived" || stop.status === "Done") {
    return { success: true, message: "Điểm dừng đã được đánh dấu tới nơi", stop };
  }

  // Kiểm tra bán kính Geofence
  let isOutsideRadius = false;
  if (phoneLat && phoneLng && stop.location?.latitude && stop.location?.longitude) {
    const radiusMeters = stop.location.geofence_radius || 500;
    // Công thức tính khoảng cách Haversine sơ bộ
    const dLat = (phoneLat - stop.location.latitude) * 111000;
    const dLng = (phoneLng - stop.location.longitude) * 111000 * Math.cos(stop.location.latitude * Math.PI / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance > radiusMeters) {
      isOutsideRadius = true;
    }
  }

  const arrivalTime = phoneTime || new Date().toISOString();
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Arrived",
    actual_arrival: arrivalTime
  });

  // Nếu là điểm dừng đầu tiên: Chuyển chuyến sang In Progress và xe sang On Trip
  if (stop.sequence === 1 && trip.status !== "In Progress") {
    await driverModel.updateTripStatus(tripId, "In Progress");
    if (trip.truck?.id) {
      await driverModel.updateTruckStatus(trip.truck.id, "On Trip");
    }
    await driverModel.updateDriverProfileStatus(profile.id, "On Trip");
  }

  // Nếu là điểm giao hàng (Drop-off): Chuyển đơn hàng sang In Transit
  if (isDropoffStop(stop) && stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "In Transit",
      `Đang vận chuyển đến điểm giao hàng #${stop.sequence}`,
      userId
    );
  }

  // Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: "Arrived",
    phoneTime: arrivalTime,
    latitude: phoneLat,
    longitude: phoneLng,
    outsideRadiusFlag: isOutsideRadius
  });

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "STOP_ARRIVED",
    targetType: "TRIP_STOP",
    targetId: stopId,
    reason: `Tài xế đã đến điểm dừng #${stop.sequence} (${stop.location?.address || 'Kho hàng'})${isOutsideRadius ? ' [NGOÀI BÁN KÍNH GEOFENCE]': ''}`,
    clientActionId: actionId
  });

  return {
    success: true,
    message: `Đã ghi nhận đến điểm dừng #${stop.sequence}`,
    stop: updatedStop,
    isOutsideRadius
  };
};

// ==========================================
// 4. TRIP WORKFLOW: RECORD PICKUP
// ==========================================

const recordPickup = async (userId, tripId, stopId, pickupData) => {
  const {
    cargo_photo_url,
    loaded_cargo_photo_url,
    seal_photo_url,
    seal_number,
    loaded_packages,
    loaded_weight,
    phoneLat = null,
    phoneLng = null,
    phoneTime = null,
    clientActionId = null
  } = pickupData;

  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  // 1. Kiểm tra các trường bắt buộc
  if (!seal_photo_url || !seal_number || !seal_number.trim()) {
    const error = new Error("Hãy chụp rõ số chì và biển số xe, rồi nhập số chì");
    error.statusCode = 400;
    throw error;
  }

  if (!loaded_packages || !loaded_weight) {
    const error = new Error("Vui lòng nhập đủ số kiện và khối lượng hàng bốc thực tế");
    error.statusCode = 400;
    throw error;
  }

  const parsedWeight = parseFloat(loaded_weight);
  const parsedPackages = parseInt(loaded_packages, 10);

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  // 2. Kiểm tra quá tải trọng xe
  const truckPayload = trip.truck?.allowed_payload || 5000;
  if (parsedWeight > truckPayload) {
    const error = new Error(`Tổng khối lượng ${parsedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe`);
    error.statusCode = 400;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop || !isPickupStop(stop)) {
    const error = new Error("Điểm dừng không hợp lệ hoặc không phải điểm lấy hàng (Pickup)");
    error.statusCode = 400;
    throw error;
  }

  // 3. Cập nhật thông tin điểm bốc hàng
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Done",
    loaded_quantity: parsedPackages,
    loaded_weight: parsedWeight
  });

  // 4. Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: "Loading Done",
    phoneTime: phoneTime || new Date().toISOString(),
    latitude: phoneLat,
    longitude: phoneLng,
    payload: {
      cargo_photo_url: cargo_photo_url || seal_photo_url,
      loaded_cargo_photo_url: loaded_cargo_photo_url || seal_photo_url,
      seal_number: seal_number.trim(),
      seal_photo_url,
      loaded_packages: parsedPackages,
      loaded_weight: parsedWeight
    }
  });

  // 5. Cập nhật đơn hàng liên kết sang Picked Up
  if (stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "Picked Up",
      `Đã lấy hàng và niêm phong chì số ${seal_number.trim()}`,
      userId
    );
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "RECORD_PICKUP",
    targetType: "TRIP_STOP",
    targetId: stopId,
    reason: `Bốc hàng thành công: ${parsedPackages} kiện (${parsedWeight} kg), Số chì: ${seal_number.trim()}`,
    clientActionId: actionId
  });

  return {
    success: true,
    message: "Ghi nhận lấy hàng và niêm chì thành công!",
    stop: updatedStop
  };
};

// ==========================================
// 5. TRIP WORKFLOW: RECORD DELIVERY & POD
// ==========================================

const recordDelivery = async (userId, tripId, stopId, deliveryData) => {
  const {
    pod_photo_url,
    cut_seal_photo_url,
    unloaded_cargo_photo_url,
    receiver_name = null,
    documents_handed_over = true,
    extra_fees = 0,
    phoneLat = null,
    phoneLng = null,
    phoneTime = null,
    clientActionId = null
  } = deliveryData;

  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop || !isDropoffStop(stop)) {
    const error = new Error("Điểm dừng không hợp lệ hoặc không phải điểm giao hàng (Drop-off)");
    error.statusCode = 400;
    throw error;
  }

  // 1. Kiểm tra ảnh theo loại hàng
  const isExport = stop.order?.order_type === "Export" || !!cut_seal_photo_url;
  if (isExport) {
    if (!cut_seal_photo_url || !unloaded_cargo_photo_url) {
      const error = new Error("Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng");
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (!pod_photo_url || !pod_photo_url.trim()) {
      const error = new Error("Hãy chụp biên bản giao nhận đã ký");
      error.statusCode = 400;
      throw error;
    }
  }

  // 2. Cập nhật thông tin điểm giao hàng
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Done",
    delivered_quantity: stop.loaded_quantity || 1,
    delivered_weight: stop.loaded_weight || 0
  });

  // 3. Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: "Left",
    phoneTime: phoneTime || new Date().toISOString(),
    latitude: phoneLat,
    longitude: phoneLng,
    payload: {
      pod_photo_url: pod_photo_url?.trim() || null,
      cut_seal_photo_url: cut_seal_photo_url?.trim() || null,
      unloaded_cargo_photo_url: unloaded_cargo_photo_url?.trim() || null,
      receiver_name: receiver_name?.trim() || null,
      documents_handed_over: !!documents_handed_over,
      extra_fees
    }
  });

  // 4. Cập nhật đơn hàng liên kết sang Delivered
  if (stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "Delivered",
      `Đã giao hàng thành công (Người nhận: ${receiver_name || "Khách hàng"})`,
      userId
    );
  }

  // 5. Kiểm tra xem có phải điểm dừng cuối cùng của chuyến không
  const allStops = trip.stops || [];
  const remainingIncompleteStops = allStops.filter(s => s.id !== stopId && s.status !== "Done");

  let isTripCompleted = false;
  if (remainingIncompleteStops.length === 0) {
    isTripCompleted = true;
    await driverModel.updateTripStatus(tripId, "Completed");

    // Giải phóng xe và tài xế về trạng thái Available / Active
    if (trip.truck?.id) {
      await driverModel.updateTruckStatus(trip.truck.id, "Available");
    }
    await driverModel.updateDriverProfileStatus(profile.id, "Active", new Date().toISOString());
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: isTripCompleted ? "COMPLETE_TRIP": "RECORD_DELIVERY",
    targetType: "TRIP_STOP",
    targetId: stopId,
    reason: isTripCompleted 
      ? `Đã hoàn tất toàn bộ điểm dừng của chuyến xe ${trip.trip_code}` 
      : `Giao hàng thành công tại điểm dừng #${stop.sequence}`,
    clientActionId: actionId
  });

  return {
    success: true,
    message: isTripCompleted 
      ? "Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe!" 
      : "Ghi nhận giao hàng và lưu POD thành công!",
    stop: updatedStop,
    isTripCompleted
  };
};

// ==========================================
// 6. REPORT INCIDENT
// ==========================================

const reportIncident = async (userId, incidentData) => {
  const {
    trip_id,
    type = "Other",
    description,
    photos = null
  } = incidentData;

  if (!description || !description.trim()) {
    const error = new Error("Vui lòng nhập mô tả chi tiết tình trạng sự cố");
    error.statusCode = 400;
    throw error;
  }

  const profile = await getMyProfile(userId);
  const realTripId = parseInt(trip_id) || 1;

  const newIncident = await driverModel.createIncident({
    tripId: realTripId,
    reportedBy: profile.id,
    type,
    description: description.trim(),
    photos
  });

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "REPORT_INCIDENT",
    targetType: "INCIDENT",
    targetId: newIncident?.id || 0,
    reason: `Tài xế báo cáo sự cố [${type}]: ${description.trim()}`
  });

  return {
    success: true,
    message: "Đã báo sự cố. Điều phối viên đã được báo!",
    incident: newIncident
  };
};

// ==========================================
// 7. STOP EVENTS & GEOFENCE
// ==========================================

// Kiểm tra độ lệch đồng hồ (BR-27)
const validatePhoneTime = (phoneTime) => {
  const now = Date.now();
  if (!phoneTime) return { time: new Date(now).toISOString(), timeFlagged: false };
  const clientTs = new Date(phoneTime).getTime();
  const driftMinutes = (clientTs - now) / 60000;
  // BR-27: Nếu phone_time vượt quá 5 phút so với đồng hồ server hoặc quá 24h trong quá khứ
  if (driftMinutes > 5 || driftMinutes < -1440) {
    return { time: new Date(now).toISOString(), timeFlagged: true };
  }
  return { time: new Date(clientTs).toISOString(), timeFlagged: false };
};

const recordStopEvent = async (userId, tripId, stopId, { eventType, phoneLat = null, phoneLng = null, phoneTime = null, clientActionId = null, payload = null } = {}) => {
  const actionId = clientActionId || crypto.randomUUID();
  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }
  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop) {
    const error = new Error("Điểm dừng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  // Geofence check
  let isOutsideRadius = false;
  if (phoneLat && phoneLng && stop.location?.latitude && stop.location?.longitude) {
    const radiusMeters = stop.location.geofence_radius || 500;
    const dLat = (phoneLat - stop.location.latitude) * 111000;
    const dLng = (phoneLng - stop.location.longitude) * 111000 * Math.cos(stop.location.latitude * Math.PI / 180);
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distance > radiusMeters) {
      isOutsideRadius = true;
    }
  }

  // BR-27 Clock validation
  const { time: recordedTime, timeFlagged } = validatePhoneTime(phoneTime);

  const normalizedEventType = (eventType || "Stop Event").trim();
  let eventPayload = {
    ...(payload || {}),
    time_flagged: timeFlagged
  };

  let waitingMinutes = 0;
  let suggestedWaitingFee = 0;
  let freeWaitingMinutes = 60;

  // Xử lý chuỗi 4 sự kiện chuẩn (Report 4 & Workflow Specification)
  if (normalizedEventType === "Loading Started") {
    // 1. Tính thời gian chờ (Waiting time: từ lúc Arrived đến lúc Loading Started)
    let arrivalTime = stop.actual_arrival;
    if (!arrivalTime) {
      const { data: arrEvents } = await supabase
        .from("trip_events")
        .select("phone_time, created_at")
        .eq("trip_stop_id", stopId)
        .eq("event_type", "Arrived")
        .order("created_at", { ascending: false })
        .limit(1);
      if (arrEvents && arrEvents.length > 0) {
        arrivalTime = arrEvents[0].phone_time || arrEvents[0].created_at;
      }
    }

    if (arrivalTime) {
      const arrTs = new Date(arrivalTime).getTime();
      const startTs = new Date(recordedTime).getTime();
      waitingMinutes = Math.max(0, Math.round((startTs - arrTs) / 60000));

      // Lấy thời gian chờ miễn phí từ system_settings
      const { data: waitSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "waiting_too_long_minutes")
        .maybeSingle();

      if (waitSetting && !isNaN(Number(waitSetting.value))) {
        freeWaitingMinutes = Number(waitSetting.value);
      }

      // BR-30: Nếu thời gian chờ vượt định mức hợp đồng/hệ thống -> Gợi ý phí chờ
      if (waitingMinutes > freeWaitingMinutes) {
        const excessMinutes = waitingMinutes - freeWaitingMinutes;
        suggestedWaitingFee = Math.ceil(excessMinutes / 30) * 100000; // 100k mỗi block 30p
      }
    }

    eventPayload.waiting_minutes = waitingMinutes;
    eventPayload.free_waiting_minutes = freeWaitingMinutes;
    eventPayload.suggested_waiting_fee = suggestedWaitingFee;

    await driverModel.updateTripStop(stopId, { status: "Loading Started" });

  } else if (normalizedEventType === "Loading Done") {
    await driverModel.updateTripStop(stopId, { status: "Loading Done" });

  } else if (normalizedEventType === "Left") {
    await driverModel.updateTripStop(stopId, { status: "Done" });

    // Nếu điểm dừng là lấy hàng và có đơn hàng, chuyển trạng thái đơn sang In Transit
    if (isPickupStop(stop) && stop.order_id) {
      await driverModel.updateOrdersStatus(
        [stop.order_id],
        "In Transit",
        `Đã rời điểm lấy hàng #${stop.sequence}, đang vận chuyển trên đường`,
        userId
      );
    }

    // Kiểm tra xem đây có phải điểm dừng cuối cùng của chuyến không
    const remainingStops = trip.stops?.filter(s => s.id !== stopId && s.status !== "Done") || [];
    if (remainingStops.length === 0) {
      // Đã hoàn thành điểm dừng cuối -> Chuyến xe hoàn thành (Completed)
      await driverModel.updateTripStatus(tripId, "Completed");
      if (trip.truck?.id) {
        await driverModel.updateTruckStatus(trip.truck.id, "Available");
      }
      await driverModel.updateDriverProfileStatus(profile.id, "Available");
      await supabase
        .from("driver_profiles")
        .update({ last_trip_ended_at: recordedTime })
        .eq("id", profile.id);
    }
  }

  const event = await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: normalizedEventType,
    phoneTime: recordedTime,
    latitude: phoneLat,
    longitude: phoneLng,
    outsideRadiusFlag: isOutsideRadius,
    payload: eventPayload
  });

  return {
    success: true,
    message: `Đã ghi nhận sự kiện ${normalizedEventType}`,
    isOutsideRadius,
    timeFlagged,
    waitingMinutes,
    suggestedWaitingFee,
    freeWaitingMinutes,
    event
  };
};

// ==========================================
// 8. CUSTOMER REFUSAL
// ==========================================

const reportCustomerRefusal = async (userId, tripId, stopId, refusalData) => {
  const {
    reason,
    cargo_photo,
    note = null,
    phoneLat = null,
    phoneLng = null,
    phoneTime = null,
    clientActionId = null
  } = refusalData;

  const actionId = clientActionId || crypto.randomUUID();
  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  if (!reason || !reason.trim()) {
    const error = new Error("Vui lòng nhập lý do khách từ chối nhận hàng");
    error.statusCode = 400;
    throw error;
  }

  if (!cargo_photo || !cargo_photo.trim()) {
    const error = new Error("Vui lòng chụp ảnh hiện trường hàng hóa bị từ chối");
    error.statusCode = 400;
    throw error;
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop) {
    const error = new Error("Điểm dừng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  if (!stop.order_id) {
    const error = new Error("Điểm dừng này không gắn với đơn hàng nào");
    error.statusCode = 400;
    throw error;
  }

  // 1. Cập nhật đơn hàng sang Delivered (Exception)
  const fullReason = note && note.trim() ? `${reason.trim()} - Ghi chú: ${note.trim()}`: reason.trim();
  await driverModel.updateOrderRefusal(stop.order_id, {
    reason: fullReason,
    photoUrl: cargo_photo.trim(),
    changedBy: userId
  });

  // 2. Cập nhật điểm dừng sang Done
  await driverModel.updateTripStop(stopId, {
    status: "Done"
  });

  // 3. Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: "Customer Refusal",
    phoneTime: phoneTime || new Date().toISOString(),
    latitude: phoneLat,
    longitude: phoneLng,
    payload: {
      orderId: stop.order_id,
      reason: fullReason,
      cargo_photo: cargo_photo.trim()
    }
  });

  // 4. Tạo thông báo cho Điều phối viên
  const orderCode = stop.order?.order_code || stop.order_id;
  if (trip.created_by) {
    await driverModel.createSystemNotification({
      userAccountId: trip.created_by,
      targetType: "ORDER",
      targetId: stop.order_id,
      message: `Khách không nhận hàng của đơn ${orderCode}. Hãy điều tài xế về kho ALS.`
    });
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "CUSTOMER_REFUSAL",
    targetType: "ORDER",
    targetId: stop.order_id,
    reason: `Tài xế báo cáo khách từ chối nhận hàng: ${fullReason}`,
    clientActionId: actionId
  });

  return {
    success: true,
    message: "Đã ghi nhận khách không nhận hàng."
  };
};

// ==========================================
// 9. PROPOSE EXTRA FEE
// ==========================================

const proposeExtraFee = async (userId, tripId, feeData) => {
  const {
    order_id = null,
    fee_type,
    amount,
    reason,
    photo_url
  } = feeData;

  const validTypes = ["Bốc xếp thêm", "Nâng hạ", "Trả kho thay khách"];
  if (!fee_type || !validTypes.includes(fee_type)) {
    const error = new Error(`Loại phụ phí không hợp lệ. Chỉ chấp nhận: ${validTypes.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const parsedAmount = parseInt(amount, 10);
  if (!parsedAmount || parsedAmount <= 0) {
    const error = new Error("Số tiền phụ phí phải lớn hơn 0");
    error.statusCode = 400;
    throw error;
  }

  if (!reason || !reason.trim()) {
    const error = new Error("Vui lòng nhập lý do phát sinh phụ phí");
    error.statusCode = 400;
    throw error;
  }

  if (!photo_url || !photo_url.trim()) {
    const error = new Error("Vui lòng chụp/tải ảnh chứng từ phụ phí");
    error.statusCode = 400;
    throw error;
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id);
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại hoặc không thuộc quyền phụ trách");
    error.statusCode = 404;
    throw error;
  }

  const newFee = await driverModel.createProposedExtraFee({
    tripId,
    orderId: order_id ? parseInt(order_id, 10): null,
    feeType: fee_type,
    amount: parsedAmount,
    reason: reason.trim(),
    photoUrl: photo_url.trim(),
    recordedBy: userId
  });

  // Thông báo cho Điều phối viên
  const driverName = profile.user?.full_name || profile.user?.username || "Tài xế";
  const orderLabel = order_id ? `đơn #${order_id}`: `chuyến ${trip.trip_code}`;
  const formattedAmount = `${parsedAmount.toLocaleString("vi-VN")} đ`;

  if (trip.created_by) {
    await driverModel.createSystemNotification({
      userAccountId: trip.created_by,
      targetType: "TRIP",
      targetId: tripId,
      message: `Tài xế ${driverName} đề xuất phí ${fee_type} ${formattedAmount} cho ${orderLabel}. Hãy xác nhận hoặc từ chối.`
    });
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "PROPOSE_EXTRA_FEE",
    targetType: "TRIP",
    targetId: tripId,
    reason: `Tài xế đề xuất phụ phí: ${fee_type} ${formattedAmount}`
  });

  return {
    success: true,
    message: `Đã gửi đề xuất phụ phí ${fee_type} ${formattedAmount}. Vui lòng chờ Điều phối viên xác nhận.`,
    extraFee: newFee
  };
};

// ==========================================
// 10. DRIVER SHIFTS
// ==========================================

const getMyShifts = async (userId, { from = null, to = null } = {}) => {
  const profile = await getMyProfile(userId);
  return await driverModel.getDriverShifts(profile.id, { from, to });
};

const addDaysStr = (dateStr, days) => {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split("T")[0];
};

const getMondaySundayOfDate = (dateStr) => {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const day = dt.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = addDaysStr(dateStr, diffToMon);
  const weekEnd = addDaysStr(weekStart, 6);
  return { weekStart, weekEnd };
};

const getNowGMT7Info = () => {
  const gmt7 = new Date(Date.now() + 7 * 3600 * 1000);
  const todayStr = gmt7.toISOString().split("T")[0];
  const dayOfWeek = gmt7.getUTCDay(); // 0=Sun..6=Sat
  const hour = gmt7.getUTCHours();
  const { weekStart: currentMondayStr, weekEnd: currentSundayStr } = getMondaySundayOfDate(todayStr);
  const nextMondayStr = addDaysStr(currentMondayStr, 7);
  const nextSundayStr = addDaysStr(nextMondayStr, 6);
  return {
    todayStr,
    dayOfWeek,
    hour,
    currentMondayStr,
    currentSundayStr,
    nextMondayStr,
    nextSundayStr,
  };
};

const normalizeWeeklyShiftType = ({ shift_type, start_time } = {}) => {
  const rawType = String(shift_type || "").trim().toUpperCase();
  if (rawType === "MORNING" || rawType === "CA_SANG" || rawType === "DAY") return "MORNING";
  if (rawType === "NIGHT" || rawType === "CA_DEM") return "NIGHT";
  if (start_time) {
    const str = String(start_time);
    const timeMatch = str.match(/T(\d{2}):/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      if (h === 8) return "MORNING";
      if (h === 17) return "NIGHT";
    }
  }
  return null;
};

const registerShift = async (userId, shiftData = {}) => {
  const profile = await getMyProfile(userId);
  const { week_start, date, shift_type, start_time, note = null } = shiftData;

  const shiftType = normalizeWeeklyShiftType({ shift_type, start_time });
  if (!shiftType) {
    const err = new Error("Vui lòng chọn ca làm việc hợp lệ: Ca Sáng (08:00 - 17:00) hoặc Ca Đêm (17:00 - 08:00 hôm sau).");
    err.statusCode = 400;
    throw err;
  }

  const nowInfo = getNowGMT7Info();
  const anchorInput = week_start || date || nowInfo.nextMondayStr;
  const anchorDateStr = String(anchorInput).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDateStr)) {
    const err = new Error("Định dạng ngày/tuần đăng ký không hợp lệ (YYYY-MM-DD).");
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
  if (weekStart === nowInfo.nextMondayStr && nowInfo.dayOfWeek === 0 && nowInfo.hour >= 22) {
    const err = new Error("Đã quá hạn chót 22:00 Chủ Nhật để đăng ký tuần tới. Hệ thống sẽ tự động xếp lịch cố định.");
    err.statusCode = 400;
    throw err;
  }

  const existingShifts = await driverModel.getShiftsInRange(profile.id, weekStart, weekEnd);
  const activeShifts = existingShifts.filter((sh) => sh.status !== "Rejected");

  const hasLockedShift = activeShifts.some(
    (sh) =>
      sh.status === "Approved" ||
      (sh.note && sh.note.includes("[Hệ thống tự động xếp lịch]")) ||
      sh.registered_by === null
  );
  if (hasLockedShift) {
    const err = new Error("Lịch làm việc tuần này đã được duyệt hoặc hệ thống tự động xếp, không thể sửa đổi!");
    err.statusCode = 400;
    throw err;
  }

  if (activeShifts.length > 0) {
    const err = new Error("Bạn đã gửi đăng ký ca cho tuần này (đang chờ duyệt). Vui lòng hủy đăng ký tuần trước khi chọn lại.");
    err.statusCode = 400;
    throw err;
  }

  const shiftLabel = shiftType === "MORNING" ? "Ca Sáng (08:00 - 17:00)" : "Ca Đêm (17:00 - 08:00 hôm sau)";
  const effectiveStartDate = weekStart < nowInfo.todayStr ? nowInfo.todayStr : weekStart;
  const shiftPayloads = [];

  let curDate = effectiveStartDate;
  while (curDate <= weekEnd) {
    const startIso = shiftType === "MORNING" ? `${curDate}T08:00:00+07:00` : `${curDate}T17:00:00+07:00`;
    const endDate = shiftType === "MORNING" ? curDate : addDaysStr(curDate, 1);
    const endIso = shiftType === "MORNING" ? `${endDate}T17:00:00+07:00` : `${endDate}T08:00:00+07:00`;
    const trimmedNote = note && String(note).trim() ? String(note).trim() : null;
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
  const result = await driverModel.cancelDriverShiftRequest(shiftId, profile.id);

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
// 11. DRIVER NOTIFICATIONS
// ==========================================

const getDriverNotifications = async (userId) => {
  return await driverModel.getDriverNotifications(userId);
};

const markNotificationRead = async (userId, notificationId) => {
  return await driverModel.markNotificationAsRead(parseInt(notificationId, 10), userId);
};

const markAllNotificationsRead = async (userId) => {
  return await driverModel.markAllNotificationsAsRead(userId);
};

// ==========================================
// 12. OFFLINE SYNC
// ==========================================

const formatActionDescription = (type, payload = {}, tripId, stopId) => {
  switch (type) {
    case "ACCEPT_TRIP":
      return `Xác nhận nhận chuyến xe ${tripId ? `#${tripId}` : ""}`.trim();
    case "ARRIVE_STOP":
      return `Đến điểm dừng ${stopId ? `#${stopId}` : ""} (Arrived)`.trim();
    case "RECORD_STOP_EVENT": {
      const eventName = payload?.event_type || payload?.eventType || "Tiến trình";
      const eventMap = {
        LOADING_START: "Bắt đầu bốc hàng (Loading Started)",
        LOADING_DONE: "Bốc hàng xong (Loading Done)",
        UNLOADING_START: "Bắt đầu dỡ hàng (Unloading Started)",
        UNLOADING_DONE: "Dỡ hàng xong (Unloading Done)",
        DEPARTED: "Xe lăn bánh rời điểm dừng (Left)"
      };
      return eventMap[eventName] || `Cập nhật trạng thái điểm dừng: ${eventName}`;
    }
    case "RECORD_PICKUP": {
      const seal = payload?.seal_number || payload?.sealNumber || "";
      return `Lấy hàng & Niêm phong seal ${seal ? `#${seal}` : ""} (Picked Up)`.trim();
    }
    case "RECORD_DELIVERY": {
      const receiver = payload?.receiver_name || payload?.receiverName || "Khách hàng";
      return `Giao hàng thành công & Ký nhận POD (${receiver})`;
    }
    case "REFUSE_CARGO": {
      const reason = payload?.rejection_reason || payload?.reason || "Khách từ chối nhận";
      return `Người nhận từ chối nhận hàng (Lý do: ${reason})`;
    }
    case "PROPOSE_EXTRA_FEE": {
      const amount = Number(payload?.amount || 0).toLocaleString("vi-VN");
      const feeName = payload?.fee_type || payload?.feeType || "Phụ phí";
      return `Đề xuất phụ phí phát sinh: ${amount} đ (${feeName})`;
    }
    case "REGISTER_SHIFT": {
      const date = payload?.date || payload?.work_date || payload?.workDate || "Ngày làm";
      let startStr = payload?.start_time || payload?.startTime || "";
      let endStr = payload?.end_time || payload?.endTime || "";
      if (typeof startStr === "string" && startStr.includes("T")) {
        try {
          const d = new Date(startStr);
          startStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch {}
      }
      if (typeof endStr === "string" && endStr.includes("T")) {
        try {
          const d = new Date(endStr);
          endStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        } catch {}
      }
      const st = normalizeWeeklyShiftType(payload);
      if (st) {
        const wk = payload?.week_start || date;
        const label = st === "MORNING" ? "Ca Sáng (08:00 - 17:00)" : "Ca Đêm (17:00 - 08:00 hôm sau)";
        return `Đăng ký ${label} cả tuần bắt đầu ${wk}`;
      }
      const hours = startStr && endStr ? ` (${startStr} - ${endStr})` : "";
      return `Đăng ký ca làm việc ngày ${date}${hours}`;
    }
    case "REPORT_INCIDENT": {
      const desc = payload?.description || payload?.type || "Sự cố giao thông";
      return `Báo cáo sự cố khẩn cấp: ${desc}`;
    }
    default:
      return `Thao tác ngoại tuyến [${type}]`;
  }
};

const syncOfflineActions = async (userId, actions = []) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { success: true, syncedCount: 0, results: [] };
  }

  if (actions.length > 50) {
    const error = new Error("Đã đạt giới hạn 50 thao tác ngoại tuyến chưa đồng bộ.");
    error.statusCode = 400;
    throw error;
  }

  const results = [];
  for (const actionItem of actions) {
    const { type, tripId, stopId, payload = {} } = actionItem || {};
    const label = formatActionDescription(type, payload, tripId, stopId);
    const clientActionId = payload?.clientActionId || actionItem?.clientActionId;
    const clientTime = payload?.phoneTime || actionItem?.phoneTime || actionItem?.queuedAt || new Date().toISOString();

    try {
      let res;
      switch (type) {
        case "ACCEPT_TRIP":
          res = await acceptTrip(userId, tripId, payload);
          break;
        case "ARRIVE_STOP":
          res = await arriveAtStop(userId, tripId, stopId, payload);
          break;
        case "RECORD_PICKUP":
          res = await recordPickup(userId, tripId, stopId, payload);
          break;
        case "RECORD_DELIVERY":
          res = await recordDelivery(userId, tripId, stopId, payload);
          break;
        case "REFUSE_CARGO":
          res = await reportCustomerRefusal(userId, tripId, stopId, payload);
          break;
        case "PROPOSE_EXTRA_FEE":
          res = await proposeExtraFee(userId, tripId, payload);
          break;
        case "RECORD_STOP_EVENT":
          res = await recordStopEvent(userId, tripId, stopId, payload);
          break;
        case "REGISTER_SHIFT":
          res = await registerShift(userId, payload);
          break;
        case "REPORT_INCIDENT":
          res = await reportIncident(userId, payload);
          break;
        default:
          res = { success: false, message: `Loại hành động không hợp lệ: ${type}` };
      }
      results.push({
        actionId: clientActionId,
        type,
        description: label,
        status: "SUCCESS",
        clientTime,
        syncedAt: new Date().toISOString(),
        res
      });
    } catch (err) {
      results.push({
        actionId: clientActionId,
        type,
        description: label,
        status: "FAILED",
        clientTime,
        syncedAt: new Date().toISOString(),
        error: err.message
      });
    }
  }

  const syncedCount = results.filter((r) => r.status === "SUCCESS").length;
  const failedCount = results.filter((r) => r.status === "FAILED").length;
  const totalCount = results.length;

  let logId = null;

  try {
    // 1. Lưu bản ghi kiểm tra chi tiết các hành động vào activity_logs (Database)
    const { data: actLog, error: actErr } = await supabase
      .from("activity_logs")
      .insert([
        {
          actor_id: userId,
          actor_type: "DRIVER",
          action: "OFFLINE_SYNC",
          target_type: "OFFLINE_SYNC",
          target_id: 0,
          changes: {
            totalCount,
            syncedCount,
            failedCount,
            items: results.map((r) => ({
              actionId: r.actionId,
              type: r.type,
              description: r.description,
              status: r.status,
              clientTime: r.clientTime,
              syncedAt: r.syncedAt,
              error: r.error || null
            }))
          },
          reason: `Đồng bộ ngoại tuyến: ${syncedCount}/${totalCount} thành công (BR-27, MSG39)`
        }
      ])
      .select();

    if (!actErr && actLog && actLog[0]) {
      logId = actLog[0].id;
    }
  } catch (logErr) {
    console.warn("Failed to insert offline sync activity log:", logErr.message);
  }

  try {
    // 2. Tạo thông báo hiển thị cho Driver tại Screen 6.5
    const notifMessage = failedCount === 0
      ? `Đã đồng bộ thành công ${syncedCount}/${totalCount} hành động ngoại tuyến lên máy chủ (BR-27, MSG39). Bấm để xem chi tiết danh sách.`
      : `Đồng bộ ngoại tuyến hoàn tất: ${syncedCount}/${totalCount} thành công (${failedCount} thao tác bị lỗi). Bấm để kiểm tra chi tiết.`;

    await supabase.from("notifications").insert([
      {
        user_account_id: userId,
        target_type: "OFFLINE_SYNC",
        target_id: logId,
        message: notifMessage,
        created_time: new Date().toISOString(),
        read_time: null
      }
    ]);
  } catch (notifErr) {
    console.warn("Failed to insert offline sync notification:", notifErr.message);
  }

  return {
    success: true,
    syncedCount,
    failedCount,
    totalCount,
    logId,
    results
  };
};

const getSyncLogDetail = async (userId, logId) => {
  if (!logId) {
    const error = new Error("Mã bản ghi đồng bộ không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, actor_id, action, target_type, changes, reason, created_time")
    .eq("id", logId)
    .eq("actor_id", userId)
    .maybeSingle();

  if (error || !data) {
    const err = new Error("Không tìm thấy chi tiết phiên đồng bộ này");
    err.statusCode = 404;
    throw err;
  }

  return data;
};

// ==========================================
// 11. SUDDEN LEAVE REQUESTS (BÁO NGHỈ ĐỘT XUẤT)
// ==========================================

const getMyLeaveRequests = async (userId) => {
  const profile = await getMyProfile(userId);
  const leaveRequests = await leaveModel.getLeaveRequests({ driverProfileId: profile.id });
  const todayStr = leaveModel.getTodayGMT7Str();
  return {
    leaveRequests,
    todayStr,
    tomorrowStr: addDaysStr(todayStr, 1),
  };
};

const submitSuddenLeaveRequest = async (userId, { dates = [], reason = "" } = {}) => {
  const profile = await getMyProfile(userId);
  const rawDates = Array.isArray(dates) ? dates : [];
  const cleanDates = [...new Set(rawDates.map((d) => String(d).split("T")[0].trim()).filter(Boolean))].sort();

  if (cleanDates.length === 0) {
    const err = new Error("Vui lòng chọn ít nhất 1 ngày sắp tới muốn xin nghỉ.");
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
    if (dStr <= todayStr) {
      const err = new Error(
        `Không thể chọn ngày hôm nay (${todayStr}) hoặc ngày đã qua. Tài xế chỉ được báo nghỉ cho các ngày từ ngày mai trở đi.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) {
    const err = new Error("Vui lòng nhập lý do xin nghỉ đột xuất.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await leaveModel.getLeaveRequests({ driverProfileId: profile.id });
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
      `Ngày ${[...new Set(conflictDates)].join(", ")} đã có đơn xin nghỉ đang chờ duyệt hoặc đã được duyệt.`
    );
    err.statusCode = 400;
    throw err;
  }

  const affectedTrips = await leaveModel.getDriverAffectedTripsByDates(profile.id, cleanDates);

  const created = await leaveModel.createLeaveRequest({
    userId,
    driverProfileId: profile.id,
    dates: cleanDates,
    reason: cleanReason,
    affectedTrips,
  });

  const driverName = profile.user?.full_name || profile.user?.username || `Tài xế #${profile.id}`;
  const dateDisplay = cleanDates.map((d) => d.split("-").reverse().join("/")).join(", ");
  const tripSummaryMsg =
    affectedTrips.length > 0
      ? ` Có ${affectedTrips.length} chuyến xe bị ảnh hưởng (${affectedTrips.map((t) => t.trip_code).join(", ")}) cần Điều phối viên đổi tài sau khi duyệt.`
      : " Không có chuyến xe nào đang giao trong các ngày này.";

  try {
    const managers = await leaveModel.getActiveUsersByRoles([2]);
    for (const mgr of managers) {
      await driverModel.createSystemNotification({
        userAccountId: mgr.id,
        targetType: "SHIFT",
        targetId: created?.id || null,
        message: `Tài xế ${driverName} gửi đơn báo nghỉ đột xuất các ngày ${dateDisplay}. Lý do: "${cleanReason}".${tripSummaryMsg}`,
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
  getMyProfile,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  acceptTrip,
  arriveAtStop,
  recordStopEvent,
  recordPickup,
  recordDelivery,
  reportCustomerRefusal,
  proposeExtraFee,
  reportIncident,
  getMyShifts,
  registerShift,
  cancelShift,
  getMyLeaveRequests,
  submitSuddenLeaveRequest,
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  syncOfflineActions,
  getSyncLogDetail
};
