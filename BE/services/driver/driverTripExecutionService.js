const crypto = require("crypto");
const driverModel = require("../../models/driverModel");
const prisma = require("../../config/prisma");
const queueAdapter = require("../../jobs/queueAdapter");
const cloudinaryService = require("../cloudinaryService");
const {
  isPickupStop,
  isReturnWarehouseStop,
  isDropoffStop,
  validatePhoneTime,
  getMyProfile,
} = require("./driverHelper");

// ==========================================
// 2. TRIP WORKFLOW: ACCEPT TRIP
// ==========================================

const acceptTrip = async (
  userId,
  tripId,
  { clientActionId = null, phoneTime = null } = {},
) => {
  const actionId = clientActionId || crypto.randomUUID();

  // 1. Kiểm tra tính bất biến Offline Sync
  if (await driverModel.checkIdempotency(actionId)) {
    return {
      success: true,
      message: "Hành động đã được ghi nhận trước đó (Idempotent)",
    };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id, { requireActive: true });

  if (!trip) {
    const error = new Error(
      "Chuyến xe không tồn tại hoặc không thuộc quyền phụ trách",
    );
    error.statusCode = 404;
    throw error;
  }

  // Nếu đã Accept trước đó thì trả về thành công
  if (trip.status === "Accepted" || trip.status === "In Progress") {
    return { success: true, message: "Chuyến xe đã được nhận", trip };
  }

  const updatedTrip = await driverModel.updateTripStatus(tripId, "Accepted");

  // Cập nhật trạng thái các đơn hàng thuộc chuyến xe sang Accepted
  const orderIds = (trip.stops || []).map((s) => s.order_id).filter(Boolean);
  const uniqueOrderIds = [...new Set(orderIds)];
  if (uniqueOrderIds.length > 0) {
    await driverModel.updateOrdersStatus(
      uniqueOrderIds,
      "ACCEPTED",
      `Tài xế đã xác nhận nhận chuyến xe ${trip.trip_code}`,
      userId,
    );
  }

  // Ghi nhận sự kiện trip_events
  await driverModel.recordTripEvent({
    clientActionId: actionId,
    tripId,
    driverId: profile.id,
    eventType: "Accepted",
    phoneTime: phoneTime || new Date().toISOString(),
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
    clientActionId: actionId,
  });

  return {
    success: true,
    message: `Đã xác nhận nhận chuyến xe ${trip.trip_code}`,
    trip: updatedTrip,
  };
};

// ==========================================
// 3. TRIP WORKFLOW: STOP ARRIVAL
// ==========================================

const arriveAtStop = async (
  userId,
  tripId,
  stopId,
  {
    phoneLat = null,
    phoneLng = null,
    phoneTime = null,
    clientActionId = null,
  } = {},
) => {
  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id, { requireActive: true });
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  if (String(trip.status || "").trim().toUpperCase() === "CANCELLED") {
    const error = new Error("Chuyến xe đã bị hủy, không thể tiếp tục thao tác.");
    error.statusCode = 400;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop) {
    const error = new Error("Điểm dừng không tồn tại trên chuyến xe này");
    error.statusCode = 404;
    throw error;
  }

  if (stop.status === "Arrived" || stop.status === "Done") {
    return {
      success: true,
      message: "Điểm dừng đã được đánh dấu tới nơi",
      stop,
    };
  }

  const arrivalTime = phoneTime || new Date().toISOString();
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Arrived",
    actual_arrival: arrivalTime,
  });

  // Nếu là điểm dừng đầu tiên: Chuyển chuyến sang In Progress và xe sang On Trip
  if (stop.sequence === 1 && trip.status !== "In Progress") {
    await driverModel.updateTripStatus(tripId, "In Progress");
    if (trip.truck?.id) {
      await driverModel.updateTruckStatus(trip.truck.id, "On Trip");
    }
    await driverModel.updateDriverProfileStatus(profile.id, "On Trip");
  }

  // Nếu là điểm giao hàng thông thường (không phải điểm hoàn kho của đơn đã bị từ chối): Chuyển đơn hàng sang IN_TRANSIT
  if (isDropoffStop(stop) && !isReturnWarehouseStop(stop) && stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "IN_TRANSIT",
      `Đang vận chuyển đến điểm giao hàng #${stop.sequence}`,
      userId,
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
  });

  // Đẩy tọa độ GPS vào Hàng đợi đệm (Bulk Ingestion Buffer) nếu có tọa độ từ thiết bị
  if (phoneLat && phoneLng) {
    queueAdapter.addGpsPointToBuffer({
      trip_id: tripId,
      latitude: phoneLat,
      longitude: phoneLng,
      speed_kmh: 0,
      recorded_time: arrivalTime,
    });
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "STOP_ARRIVED",
    targetType: "TRIP_STOP",
    targetId: stopId,
    reason: `Tài xế đã đến điểm dừng #${stop.sequence} (${stop.location?.address || "Kho hàng"})`,
    clientActionId: actionId,
  });

  return {
    success: true,
    message: `Đã ghi nhận đến điểm dừng #${stop.sequence}`,
    stop: updatedStop,
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
    clientActionId = null,
  } = pickupData;

  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  // 1. Kiểm tra các trường bắt buộc
  if (!seal_photo_url || !seal_number || !seal_number.trim()) {
    const error = new Error(
      "Hãy chụp rõ số chì và biển số xe, rồi nhập số chì",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!loaded_packages || !loaded_weight) {
    const error = new Error(
      "Vui lòng nhập đủ số kiện và khối lượng hàng bốc thực tế",
    );
    error.statusCode = 400;
    throw error;
  }

  const parsedWeight = parseFloat(loaded_weight);
  const parsedPackages = parseInt(loaded_packages, 10);

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id, { requireActive: true });
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  if (String(trip.status || "").trim().toUpperCase() === "CANCELLED") {
    const error = new Error("Chuyến xe đã bị hủy, không thể tiếp tục thao tác.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Kiểm tra quá tải trọng xe
  const truckPayload = trip.truck?.allowed_payload || 5000;
  if (parsedWeight > truckPayload) {
    const error = new Error(
      `Tổng khối lượng ${parsedWeight} kg vượt tải trọng cho phép ${truckPayload} kg của xe`,
    );
    error.statusCode = 400;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop || !isPickupStop(stop)) {
    const error = new Error(
      "Điểm dừng không hợp lệ hoặc không phải điểm lấy hàng (Pickup)",
    );
    error.statusCode = 400;
    throw error;
  }

  const uploadFolder = `nexlog/trips/${tripId}/pickup`;
  const [resolvedCargoUrl, resolvedLoadedUrl, resolvedSealUrl] =
    await Promise.all([
      cloudinaryService.uploadDataUriIfNeeded(cargo_photo_url, uploadFolder),
      cloudinaryService.uploadDataUriIfNeeded(
        loaded_cargo_photo_url,
        uploadFolder,
      ),
      cloudinaryService.uploadDataUriIfNeeded(seal_photo_url, uploadFolder),
    ]);

  // 3. Cập nhật thông tin điểm bốc hàng
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Loading Done",
    loaded_quantity: parsedPackages,
    loaded_weight: parsedWeight,
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
      cargo_photo_url: resolvedCargoUrl || resolvedSealUrl,
      loaded_cargo_photo_url: resolvedLoadedUrl || resolvedSealUrl,
      seal_number: seal_number.trim(),
      seal_photo_url: resolvedSealUrl,
      loaded_packages: parsedPackages,
      loaded_weight: parsedWeight,
    },
  });

  // 5. Cập nhật đơn hàng liên kết sang PICKED_UP
  if (stop.order_id) {
    await driverModel.updateOrdersStatus(
      [stop.order_id],
      "PICKED_UP",
      `Đã lấy hàng và niêm phong chì số ${seal_number.trim()}`,
      userId,
    );
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "RECORD_PICKUP",
    targetType: "TRIP_STOP",
    targetId: stopId,
    reason: `Bốc hàng thành công: ${parsedPackages} kiện (${parsedWeight} kg), Số chì: ${seal_number.trim()}`,
    clientActionId: actionId,
  });

  return {
    success: true,
    message: "Ghi nhận lấy hàng và niêm chì thành công!",
    stop: updatedStop,
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
    clientActionId = null,
  } = deliveryData;

  const actionId = clientActionId || crypto.randomUUID();

  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }

  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id, { requireActive: true });
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  if (String(trip.status || "").trim().toUpperCase() === "CANCELLED") {
    const error = new Error("Chuyến xe đã bị hủy, không thể tiếp tục thao tác.");
    error.statusCode = 400;
    throw error;
  }

  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop || !isDropoffStop(stop)) {
    const error = new Error(
      "Điểm dừng không hợp lệ hoặc không phải điểm giao hàng (Drop-off)",
    );
    error.statusCode = 400;
    throw error;
  }

  // BUG-SYS-18: Không tạo thêm bằng chứng POD trùng lặp nếu điểm dừng đã hoàn tất giao hàng
  if (["DONE", "DELIVERED", "COMPLETED"].includes(String(stop.status || "").trim().toUpperCase())) {
    return {
      success: true,
      message: "Điểm dừng này đã được xác nhận giao hàng trước đó.",
      stop,
    };
  }

  // 1. Kiểm tra ảnh theo loại điểm dừng (Điểm hoàn hàng về kho ALS / Xuất khẩu / Nhập khẩu)
  const isReturnToAls = isReturnWarehouseStop(stop);
  const isExport =
    !isReturnToAls &&
    (stop.order?.order_type === "Export" || !!cut_seal_photo_url);

  if (isReturnToAls) {
    const returnPhoto =
      unloaded_cargo_photo_url?.trim() ||
      pod_photo_url?.trim() ||
      cut_seal_photo_url?.trim();
    if (!returnPhoto) {
      const error = new Error(
        "Vui lòng chụp ảnh hàng hóa đã hạ xuống Kho ALS lưu giữ",
      );
      error.statusCode = 400;
      throw error;
    }
  } else if (isExport) {
    if (!cut_seal_photo_url || !unloaded_cargo_photo_url) {
      const error = new Error(
        "Hàng xuất khẩu bắt buộc chụp ảnh cắt chì và ảnh dỡ hàng",
      );
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

  const uploadFolder = `nexlog/trips/${tripId}/delivery`;
  const [resolvedPodUrl, resolvedCutSealUrl, resolvedUnloadedUrl] =
    await Promise.all([
      cloudinaryService.uploadDataUriIfNeeded(
        pod_photo_url?.trim() || null,
        uploadFolder,
      ),
      cloudinaryService.uploadDataUriIfNeeded(
        cut_seal_photo_url?.trim() || null,
        uploadFolder,
      ),
      cloudinaryService.uploadDataUriIfNeeded(
        unloaded_cargo_photo_url?.trim() || null,
        uploadFolder,
      ),
    ]);

  // 2. Cập nhật thông tin điểm giao hàng
  const updatedStop = await driverModel.updateTripStop(stopId, {
    status: "Done",
    delivered_quantity: stop.loaded_quantity || 1,
    delivered_weight: stop.loaded_weight || 0,
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
      pod_photo_url: resolvedPodUrl || null,
      cut_seal_photo_url: resolvedCutSealUrl || null,
      unloaded_cargo_photo_url: resolvedUnloadedUrl || null,
      receiver_name: receiver_name?.trim() || null,
      documents_handed_over: !!documents_handed_over,
      extra_fees,
    },
  });

  // 3.1. Lưu trực tiếp vào bảng delivery_evidences để bảo đảm hiển thị đầy đủ trên mọi view giám sát
  if (resolvedPodUrl || resolvedCutSealUrl || resolvedUnloadedUrl) {
    try {
      const evidencesToInsert = [];
      const nowDate = new Date();
      if (resolvedPodUrl) {
        evidencesToInsert.push({
          trip_stop_id: BigInt(stopId),
          order_id: stop.order_id ? BigInt(stop.order_id) : null,
          type: isReturnToAls ? "ReturnWarehouse" : "POD",
          file_link: resolvedPodUrl.slice(0, 255),
          receiver_name: receiver_name?.trim()
            ? receiver_name.trim().slice(0, 100)
            : null,
          captured_time: nowDate,
          latitude: phoneLat,
          longitude: phoneLng,
        });
      }
      if (resolvedCutSealUrl) {
        evidencesToInsert.push({
          trip_stop_id: BigInt(stopId),
          order_id: stop.order_id ? BigInt(stop.order_id) : null,
          type: "CutSeal",
          file_link: resolvedCutSealUrl.slice(0, 255),
          receiver_name: receiver_name?.trim()
            ? receiver_name.trim().slice(0, 100)
            : null,
          captured_time: nowDate,
          latitude: phoneLat,
          longitude: phoneLng,
        });
      }
      if (resolvedUnloadedUrl) {
        evidencesToInsert.push({
          trip_stop_id: BigInt(stopId),
          order_id: stop.order_id ? BigInt(stop.order_id) : null,
          type: isReturnToAls ? "ReturnWarehouse" : "Unloaded",
          file_link: resolvedUnloadedUrl.slice(0, 255),
          receiver_name: receiver_name?.trim()
            ? receiver_name.trim().slice(0, 100)
            : null,
          captured_time: nowDate,
          latitude: phoneLat,
          longitude: phoneLng,
        });
      }
      if (evidencesToInsert.length > 0) {
        await prisma.delivery_evidences.createMany({ data: evidencesToInsert });
      }
    } catch (e) {
      console.warn(
        "[recordDelivery] Error inserting into delivery_evidences:",
        e.message,
      );
    }
  }

  // 4. Cập nhật trạng thái đơn hàng liên kết
  const warehouseDisplayName =
    stop.location?.name || stop.location?.address || "Kho ALS";
  if (stop.order_id) {
    if (isReturnToAls) {
      await driverModel.closeRefusedOrderAtWarehouse(stop.order_id, {
        warehouseName: warehouseDisplayName,
        changedBy: userId,
      });
    } else {
      const extraOrderData = { is_closed: true };
      if (isExport) {
        extraOrderData.warehouse_name = warehouseDisplayName;
      }
      await driverModel.updateOrdersStatus(
        [stop.order_id],
        "DELIVERED",
        `Đã giao hàng thành công (Người nhận: ${receiver_name || "Khách hàng"})`,
        userId,
        extraOrderData,
      );
    }
  }

  // 5. Kiểm tra xem có phải điểm dừng cuối cùng của chuyến không
  const allStops = trip.stops || [];
  const remainingIncompleteStops = allStops.filter(
    (s) => s.id !== stopId && s.status !== "Done",
  );

  let isTripCompleted = false;
  if (remainingIncompleteStops.length === 0) {
    isTripCompleted = true;
    await driverModel.updateTripStatus(tripId, "Completed");

    // Giải phóng xe và tài xế về trạng thái Available / Active
    if (trip.truck?.id) {
      await driverModel.updateTruckStatus(trip.truck.id, "Available");
    }
    await driverModel.updateDriverProfileStatus(
      profile.id,
      "Active",
      new Date().toISOString(),
    );
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
    clientActionId: actionId,
  });

  return {
    success: true,
    message: isTripCompleted
      ? "Chúc mừng! Bạn đã hoàn thành toàn bộ chuyến xe!"
      : "Ghi nhận giao hàng và lưu POD thành công!",
    stop: updatedStop,
    isTripCompleted,
  };
};

// ==========================================
// 7. STOP EVENTS
// ==========================================

const recordStopEvent = async (
  userId,
  tripId,
  stopId,
  {
    eventType,
    phoneLat = null,
    phoneLng = null,
    phoneTime = null,
    clientActionId = null,
    payload = null,
  } = {},
) => {
  const actionId = clientActionId || crypto.randomUUID();
  if (await driverModel.checkIdempotency(actionId)) {
    return { success: true, message: "Hành động đã được ghi nhận trước đó" };
  }
  const profile = await getMyProfile(userId);
  const trip = await driverModel.getTripDetail(tripId, profile.id, { requireActive: true });
  if (!trip) {
    const error = new Error("Chuyến xe không tồn tại");
    error.statusCode = 404;
    throw error;
  }
  if (String(trip.status || "").trim().toUpperCase() === "CANCELLED") {
    const error = new Error("Chuyến xe đã bị hủy, không thể tiếp tục thao tác.");
    error.statusCode = 400;
    throw error;
  }
  const stop = await driverModel.getTripStopById(stopId, tripId);
  if (!stop) {
    const error = new Error("Điểm dừng không tồn tại");
    error.statusCode = 404;
    throw error;
  }

  // BR-27 Clock validation
  const { time: recordedTime, timeFlagged } = validatePhoneTime(phoneTime);

  const normalizedEventType = (eventType || "Stop Event").trim();
  const currentStopStatus = String(stop.status || "").trim().toUpperCase();

  // BUG-SYS-16: Bắt buộc tuân thủ thứ tự 4 bước điểm dừng (Arrived -> Loading Started -> Loading Done -> Left)
  const normStopSt = currentStopStatus.replace(/\s+/g, "_");
  const isRestStop = String(stop.stop_type || stop.type || "").trim().toUpperCase() === "REST";
  if (normalizedEventType === "Loading Started" && normStopSt !== "ARRIVED") {
    const error = new Error(
      `Không thể ghi nhận "Loading Started" khi điểm dừng chưa ở trạng thái Arrived (hiện tại: ${stop.status}).`,
    );
    error.statusCode = 400;
    throw error;
  }
  if (normalizedEventType === "Loading Done" && normStopSt !== "LOADING_STARTED") {
    const error = new Error(
      `Không thể ghi nhận "Loading Done" khi chưa bắt đầu bốc/dỡ hàng (Loading Started).`,
    );
    error.statusCode = 400;
    throw error;
  }
  if (normalizedEventType === "Left") {
    const allowedBeforeLeft = isRestStop ? ["ARRIVED", "LOADING_DONE"] : ["LOADING_DONE"];
    if (!allowedBeforeLeft.includes(normStopSt)) {
      const error = new Error(
        `Không thể ghi nhận "Left" khi chưa hoàn thành các bước trước đó (hiện tại: ${stop.status}).`,
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // BUG-SYS-36: Không cho phép thao tác trên đơn hàng đã bị hủy
  if (stop.order_id) {
    const stopOrder = await prisma.orders.findUnique({
      where: { id: BigInt(stop.order_id) },
      select: { status: true },
    });
    if (String(stopOrder?.status || "").trim().toUpperCase() === "CANCELLED") {
      const error = new Error("Đơn hàng của điểm dừng này đã bị hủy, không thể cập nhật trạng thái.");
      error.statusCode = 400;
      throw error;
    }
  }
  let eventPayload = {
    ...(payload || {}),
    time_flagged: timeFlagged,
  };

  let waitingMinutes = 0;
  let suggestedWaitingFee = 0;
  let freeWaitingMinutes = 60;

  // Xử lý chuỗi 4 sự kiện chuẩn (Report 4 & Workflow Specification)
  if (normalizedEventType === "Loading Started") {
    // 1. Tính thời gian chờ (Waiting time: từ lúc Arrived đến lúc Loading Started)
    let arrivalTime = stop.actual_arrival;
    if (!arrivalTime) {
      const arrEvent = await prisma.trip_events.findFirst({
        where: {
          trip_stop_id: BigInt(stopId),
          event_type: "Arrived",
        },
        select: { phone_time: true, created_at: true },
        orderBy: { created_at: "desc" },
      });
      if (arrEvent) {
        arrivalTime = arrEvent.phone_time || arrEvent.created_at;
      }
    }

    if (arrivalTime) {
      const arrTs = new Date(arrivalTime).getTime();
      const startTs = new Date(recordedTime).getTime();
      waitingMinutes = Math.max(0, Math.round((startTs - arrTs) / 60000));

      // Lấy thời gian chờ miễn phí từ system_settings
      const waitSetting = await prisma.system_settings.findUnique({
        where: { key: "waiting_too_long_minutes" },
        select: { value: true },
      });

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

    // Nếu điểm dừng là lấy hàng và có đơn hàng, chuyển trạng thái đơn sang IN_TRANSIT
    if (isPickupStop(stop) && stop.order_id) {
      await driverModel.updateOrdersStatus(
        [stop.order_id],
        "IN_TRANSIT",
        `Đã rời điểm lấy hàng #${stop.sequence}, đang vận chuyển trên đường`,
        userId,
      );
    }

    // Kiểm tra xem đây có phải điểm dừng cuối cùng của chuyến không
    // Nếu trên chuyến có đơn đang ở DELIVERED_EXCEPTION nhưng chưa đóng,
    // chuyến xe chỉ hoàn thành sau khi tài xế đã hạ hàng hoàn tại Kho ALS.
    if (isReturnWarehouseStop(stop) && stop.order_id) {
      const warehouseDisplayName =
        stop.location?.name || stop.location?.address || "Kho ALS";
      await driverModel.closeRefusedOrderAtWarehouse(stop.order_id, {
        warehouseName: warehouseDisplayName,
        changedBy: userId,
      });
    }

    const remainingStops =
      trip.stops?.filter((s) => s.id !== stopId && s.status !== "Done") || [];
    const hasUnclosedRefusedOrder = (trip.stops || []).some((s) => {
      if (s.id === stopId && isReturnWarehouseStop(stop)) return false;
      const st = String(s.order?.status || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_");
      return st === "DELIVERED_EXCEPTION" && !s.order?.is_closed;
    });

    if (remainingStops.length === 0 && !hasUnclosedRefusedOrder) {
      // Đã hoàn thành điểm dừng cuối -> Chuyến xe hoàn thành (Completed)
      await driverModel.updateTripStatus(tripId, "Completed");
      if (trip.truck?.id) {
        await driverModel.updateTruckStatus(trip.truck.id, "Available");
      }
      await driverModel.updateDriverProfileStatus(profile.id, "Active");
      await prisma.driver_profiles.update({
        where: { id: BigInt(profile.id) },
        data: { last_trip_ended_at: new Date(recordedTime) },
      });
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
    payload: eventPayload,
  });

  // Đẩy tọa độ GPS vào Hàng đợi đệm (Bulk Ingestion Buffer) nếu có tọa độ từ thiết bị
  if (phoneLat && phoneLng) {
    queueAdapter.addGpsPointToBuffer({
      trip_id: tripId,
      latitude: phoneLat,
      longitude: phoneLng,
      speed_kmh: 0,
      recorded_time: recordedTime,
    });
  }

  return {
    success: true,
    message: `Đã ghi nhận sự kiện ${normalizedEventType}`,
    timeFlagged,
    waitingMinutes,
    suggestedWaitingFee,
    freeWaitingMinutes,
    event,
  };
};

module.exports = {
  acceptTrip,
  arriveAtStop,
  recordPickup,
  recordDelivery,
  recordStopEvent,
};
