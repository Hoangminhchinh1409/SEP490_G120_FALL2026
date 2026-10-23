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
  const drivingHours = await driverModel.getDriverDrivingTimeStats(profile.id);
  return {
    ...profile,
    drivingHours
  };
};

const getActiveTrip = async (userId) => {
  const profile = await getMyProfile(userId);
  const trip = await driverModel.getActiveTrip(profile.id);

  if (!trip) {
    return {
      hasActiveTrip: false,
      message: "Hiện tại bạn chưa có chuyến xe nào được phân công.",
      trip: null,
      drivingHours: profile.drivingHours
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

  // 1. Kiểm tra các trường bắt buộc (BR-11 & MSG18 & MSG02)
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
      cargo_photo_url: cargo_photo_url || seal_photo_url,
      loaded_cargo_photo_url: loaded_cargo_photo_url || seal_photo_url,
      seal_number: seal_number.trim(),
      seal_photo_url,
      loaded_packages: parsedPackages,
      loaded_weight: parsedWeight
    }
  });

  // 5. Cập nhật đơn hàng liên kết sang Picked Up (BR-11, BR-14)
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
    message: "Ghi nhận lấy hàng và niêm chì thành công! (BR-11)",
    stop: updatedStop
  };
};

// ==========================================
// 5. TRIP WORKFLOW: RECORD DELIVERY & POD (BR-12, BR-39, BR-24)
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
  if (!stop || stop.stop_type !== "Drop-off") {
    const error = new Error("Điểm dừng không hợp lệ hoặc không phải điểm giao hàng (Drop-off)");
    error.statusCode = 400;
    throw error;
  }

  // 1. Kiểm tra ảnh theo loại hàng (BR-12 & MSG20)
  const isExport = stop.order?.order_type === "Export" || !!cut_seal_photo_url;
  if (isExport) {
    if (!cut_seal_photo_url || !unloaded_cargo_photo_url) {
      const error = new Error("Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng (BR-12)");
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (!pod_photo_url || !pod_photo_url.trim()) {
      const error = new Error("Hãy chụp biên bản giao nhận đã ký (MSG20)");
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

  // 4. Cập nhật đơn hàng liên kết sang Delivered (BR-39)
  if (stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "Delivered",
      `Đã giao hàng thành công (Người nhận: ${receiver_name || "Khách hàng"})`,
      userId
    );
  }

  // 5. Kiểm tra xem có phải điểm dừng cuối cùng của chuyến không (BR-24, BR-40)
  const allStops = trip.stops || [];
  const remainingIncompleteStops = allStops.filter(s => s.id !== stopId && s.status !== "Done");

  let isTripCompleted = false;
  if (remainingIncompleteStops.length === 0) {
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
// 7. STOP EVENTS & GEOFENCE (BR-36)
// ==========================================

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

  // Geofence check (BR-36)
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

  const recordedTime = phoneTime || new Date().toISOString();
  const event = await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    tripStopId: stopId,
    driverId: profile.id,
    eventType: eventType || "Stop Event",
    phoneTime: recordedTime,
    latitude: phoneLat,
    longitude: phoneLng,
    outsideRadiusFlag: isOutsideRadius,
    payload
  });

  return {
    success: true,
    message: `Đã ghi nhận sự kiện ${eventType || "điểm dừng"}`,
    isOutsideRadius,
    event
  };
};

// ==========================================
// 8. CUSTOMER REFUSAL (BR-57, MSG74, MSG75)
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
    const error = new Error("Vui lòng nhập lý do khách từ chối nhận hàng (MSG02)");
    error.statusCode = 400;
    throw error;
  }

  if (!cargo_photo || !cargo_photo.trim()) {
    const error = new Error("Vui lòng chụp ảnh hiện trường hàng hóa bị từ chối (MSG02)");
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

  // 1. Cập nhật đơn hàng sang Delivered (Exception) (BR-57)
  const fullReason = note && note.trim() ? `${reason.trim()} - Ghi chú: ${note.trim()}` : reason.trim();
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

  // 4. Tạo thông báo cho Điều phối viên (MSG75)
  const orderCode = stop.order?.order_code || stop.order_id;
  if (trip.created_by) {
    await driverModel.createSystemNotification({
      userAccountId: trip.created_by,
      targetType: "ORDER",
      targetId: stop.order_id,
      message: `Khách không nhận hàng của đơn ${orderCode}. Hãy điều tài xế về kho ALS. (MSG75)`
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
    message: "Đã ghi nhận khách không nhận hàng. (MSG74)"
  };
};

// ==========================================
// 9. PROPOSE EXTRA FEE (BR-30, MSG85)
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
    orderId: order_id ? parseInt(order_id, 10) : null,
    feeType: fee_type,
    amount: parsedAmount,
    reason: reason.trim(),
    photoUrl: photo_url.trim(),
    recordedBy: userId
  });

  // Thông báo cho Điều phối viên (MSG85)
  const driverName = profile.user?.full_name || profile.user?.username || "Tài xế";
  const orderLabel = order_id ? `đơn #${order_id}` : `chuyến ${trip.trip_code}`;
  const formattedAmount = `${parsedAmount.toLocaleString("vi-VN")} đ`;

  if (trip.created_by) {
    await driverModel.createSystemNotification({
      userAccountId: trip.created_by,
      targetType: "TRIP",
      targetId: tripId,
      message: `Tài xế ${driverName} đề xuất phí ${fee_type} ${formattedAmount} cho ${orderLabel}. Hãy xác nhận hoặc từ chối. (MSG85)`
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
    message: `Đã gửi đề xuất phụ phí ${fee_type} ${formattedAmount}. Vui lòng chờ Điều phối viên xác nhận. (MSG85)`,
    extraFee: newFee
  };
};

// ==========================================
// 10. DRIVER SHIFTS (UC-20, BR-60, MSG77, MSG78)
// ==========================================

const getMyShifts = async (userId, { from = null, to = null } = {}) => {
  const profile = await getMyProfile(userId);
  return await driverModel.getDriverShifts(profile.id, { from, to });
};

const registerShift = async (userId, shiftData) => {
  const { date, start_time, end_time, note = null } = shiftData;

  if (!date || !start_time || !end_time) {
    const error = new Error("Vui lòng nhập đầy đủ ngày làm việc, giờ bắt đầu và kết thúc (MSG02)");
    error.statusCode = 400;
    throw error;
  }

  const shiftDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (shiftDate < today) {
    const error = new Error("Ngày đăng ký ca phải từ hôm nay trở đi");
    error.statusCode = 400;
    throw error;
  }

  const startTimeObj = new Date(start_time);
  const endTimeObj = new Date(end_time);

  if (startTimeObj >= endTimeObj) {
    const error = new Error("Giờ kết thúc phải sau giờ bắt đầu ca làm việc");
    error.statusCode = 400;
    throw error;
  }

  if (note && note.length > 200) {
    const error = new Error("Ghi chú ca làm việc không được vượt quá 200 ký tự");
    error.statusCode = 400;
    throw error;
  }

  const profile = await getMyProfile(userId);

  // Kiểm tra trùng ca (BR-60 & MSG78)
  const isOverlap = await driverModel.checkShiftOverlap(profile.id, date, start_time, end_time);
  if (isOverlap) {
    const error = new Error("Ca này trùng với ca khác của bạn. (MSG78)");
    error.statusCode = 400;
    throw error;
  }

  const shift = await driverModel.createDriverShift({
    driverId: profile.id,
    date,
    startTime: start_time,
    endTime: end_time,
    note: note ? note.trim() : null,
    registeredBy: userId
  });

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "REGISTER_SHIFT",
    targetType: "DRIVER_SHIFT",
    targetId: shift.id,
    reason: `Tài xế đăng ký ca làm việc ngày ${date} (${start_time} - ${end_time})`
  });

  return {
    success: true,
    message: "Đã gửi đăng ký ca. Vui lòng chờ Quản lý duyệt. (MSG77)",
    shift
  };
};

// ==========================================
// 11. DRIVER NOTIFICATIONS (Screen 6.5, MSG80)
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
// 12. OFFLINE SYNC (BR-27, MSG39)
// ==========================================

const syncOfflineActions = async (userId, actions = []) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { success: true, syncedCount: 0, results: [] };
  }

  if (actions.length > 50) {
    const error = new Error("Đã đạt giới hạn 50 thao tác ngoại tuyến chưa đồng bộ. (MSG39)");
    error.statusCode = 400;
    throw error;
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
  recordStopEvent,
  recordPickup,
  recordDelivery,
  reportCustomerRefusal,
  proposeExtraFee,
  reportIncident,
  getMyShifts,
  registerShift,
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  syncOfflineActions
};

