const crypto = require("crypto");
const driverModel = require("../models/driverModel");

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
  return profile;
};

const getActiveTrip = async (userId) => {
  const profile = await getMyProfile(userId);
  const trip = await driverModel.getActiveTrip(profile.id);

  if (!trip) {
    return {
      hasActiveTrip: false,
      message: "Hiện tại bạn chưa có chuyến xe nào được phân công.",
      trip: null
    };
  }

  // Xác định điểm dừng kế tiếp cần thực hiện (điểm dừng chưa hoàn thành 'Done')
  let currentStop = null;
  if (trip.stops && trip.stops.length > 0) {
    currentStop = trip.stops.find(s => s.status !== "Done") || trip.stops[trip.stops.length - 1];
  }

  return {
    hasActiveTrip: true,
    trip,
    currentStop
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
// 2. TRIP WORKFLOW: ACCEPT TRIP (UC-29)
// ==========================================

const acceptTrip = async (userId, tripId, { clientActionId = null, phoneTime = null } = {}) => {
  const actionId = clientActionId || crypto.randomUUID();

  // 1. Kiểm tra tính bất biến Offline Sync (BR-27)
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

  // Cập nhật trạng thái các đơn hàng thuộc chuyến xe sang Accepted (UC-28)
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
// 3. TRIP WORKFLOW: STOP ARRIVAL (BR-36)
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

  // Kiểm tra bán kính Geofence (BR-36)
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

  // Nếu là điểm giao hàng (Drop-off): Chuyển đơn hàng sang In Transit (UC-30)
  if (stop.stop_type === "Drop-off" && stop.order_id) {
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
    reason: `Tài xế đã đến điểm dừng #${stop.sequence} (${stop.location?.address || 'Kho hàng'})${isOutsideRadius ? ' [NGOÀI BÁN KÍNH GEOFENCE]' : ''}`,
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
// 4. TRIP WORKFLOW: RECORD PICKUP (BR-11, BR-31, BR-33)
// ==========================================

const recordPickup = async (userId, tripId, stopId, pickupData) => {
  const {
    seal_number,
    seal_photo_url,
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

  // 1. Kiểm tra các trường bắt buộc (BR-11 & MSG18)
  if (!seal_photo_url || !seal_number || !seal_number.trim()) {
    const error = new Error("Hãy chụp rõ số chì và biển số xe, rồi nhập số chì (MSG18)");
    error.statusCode = 400;
    throw error;
  }

  if (!loaded_packages || !loaded_weight) {
    const error = new Error("Vui lòng nhập đủ số kiện và khối lượng hàng bốc thực tế (MSG02)");
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

  // 2. Kiểm tra quá tải trọng xe (BR-33 & MSG45)
  const truckPayload = trip.truck?.allowed_payload || 5000;
  if (parsedWeight > truckPayload) {
    const error = new Error(`Tổng khối lượng ${parsedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe (MSG45)`);
    error.statusCode = 400;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop || stop.stop_type !== "Pickup") {
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
      seal_number: seal_number.trim(),
      seal_photo_url,
      loaded_packages: parsedPackages,
      loaded_weight: parsedWeight
    }
  });

  // 5. Cập nhật đơn hàng liên kết sang Picked Up (BR-14)
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
// 5. TRIP WORKFLOW: RECORD DELIVERY & POD (BR-12, BR-39, BR-24)
// ==========================================

const recordDelivery = async (userId, tripId, stopId, deliveryData) => {
  const {
    pod_photo_url,
    receiver_name = null,
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

  // 1. Kiểm tra ảnh POD bắt buộc (BR-12 & MSG20)
  if (!pod_photo_url || !pod_photo_url.trim()) {
    const error = new Error("Hãy chụp biên bản giao nhận đã ký (MSG20)");
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
  if (!stop || stop.stop_type !== "Drop-off") {
    const error = new Error("Điểm dừng không hợp lệ hoặc không phải điểm giao hàng (Drop-off)");
    error.statusCode = 400;
    throw error;
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
      pod_photo_url: pod_photo_url.trim(),
      receiver_name: receiver_name?.trim() || null,
      extra_fees
    }
  });

  // 4. Cập nhật đơn hàng liên kết sang Delivered (BR-39)
  if (stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "Delivered",
      `Đã giao hàng thành công và chụp biên bản POD (Người nhận: ${receiver_name || "Khách hàng"})`,
      userId
    );
  }

  // 5. Kiểm tra xem có phải điểm dừng cuối cùng của chuyến không (BR-24, BR-40)
  const allStops = trip.stops || [];
  const remainingIncompleteStops = allStops.filter(s => s.id !== stopId && s.status !== "Done");

  let isTripCompleted = false;
  if (remainingIncompleteStops.length === 0) {
    // Hoàn thành toàn bộ chuyến xe!
    isTripCompleted = true;
    await driverModel.updateTripStatus(tripId, "Completed");

    // Giải phóng xe và tài xế về trạng thái Available / Active (BR-24)
    if (trip.truck?.id) {
      await driverModel.updateTruckStatus(trip.truck.id, "Available");
    }
    await driverModel.updateDriverProfileStatus(profile.id, "Active", new Date().toISOString());
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: isTripCompleted ? "COMPLETE_TRIP" : "RECORD_DELIVERY",
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
// 6. REPORT INCIDENT (UC-32 & BF-04)
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
    message: "Đã báo sự cố. Điều phối viên đã được báo (MSG21)!",
    incident: newIncident
  };
};

// ==========================================
// 7. OFFLINE SYNC (BR-27)
// ==========================================

const syncOfflineActions = async (userId, actions = []) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { success: true, syncedCount: 0, results: [] };
  }

  const results = [];
  for (const actionItem of actions) {
    try {
      const { type, tripId, stopId, payload } = actionItem;
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
        case "REPORT_INCIDENT":
          res = await reportIncident(userId, payload);
          break;
        default:
          res = { success: false, message: `Loại hành động không hợp lệ: ${type}` };
      }
      results.push({ actionId: payload?.clientActionId, success: true, res });
    } catch (err) {
      results.push({ actionId: actionItem?.payload?.clientActionId, success: false, error: err.message });
    }
  }

  return {
    success: true,
    syncedCount: results.filter(r => r.success).length,
    results
  };
};

module.exports = {
  getMyProfile,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  acceptTrip,
  arriveAtStop,
  recordPickup,
  recordDelivery,
  reportIncident,
  syncOfflineActions
};
