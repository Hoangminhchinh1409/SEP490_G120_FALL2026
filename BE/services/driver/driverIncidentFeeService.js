const crypto = require("crypto");
const driverModel = require("../../models/driverModel");
const prisma = require("../../config/prisma");
const { serializePrisma } = require("../../utils/prismaHelper");
const cloudinaryService = require("../cloudinaryService");
const { getMyProfile } = require("./driverHelper");

// ==========================================
// 6. REPORT INCIDENT
// ==========================================

const reportIncident = async (userId, incidentData) => {
  const {
    trip_id,
    trip_stop_id,
    type = "Other",
    description,
    photos = null,
    incident_lat = null,
    incident_lng = null,
  } = incidentData;

  if (!description || !description.trim()) {
    const error = new Error("Vui lòng nhập mô tả chi tiết tình trạng sự cố");
    error.statusCode = 400;
    throw error;
  }

  const profile = await getMyProfile(userId);

  // 1. Luôn xác định và gắn trực tiếp với chuyến xe hiện tại đang hoạt động của tài xế
  let realTripId = null;
  let realTripStopId = trip_stop_id ? parseInt(trip_stop_id, 10) : null;
  let currentTrip = null;

  // Lấy chuyến xe đang chạy hoặc đang được phân công của tài xế (In Progress, Accepted, Dispatched, Assigned)
  const activeTripRes = await driverModel.getActiveTrip(profile.id);
  currentTrip =
    activeTripRes?.activeTrip ||
    (activeTripRes?.id ? activeTripRes : null) ||
    activeTripRes?.upcomingTrips?.[0] ||
    null;

  if (currentTrip && currentTrip.id) {
    // Ưu tiên cao nhất: Gắn vào chuyến xe đang chạy thực tế của chính tài xế này
    realTripId = currentTrip.id;
    if (!realTripStopId && currentTrip.stops && currentTrip.stops.length > 0) {
      const activeStop =
        currentTrip.stops.find((s) => s.status !== "Done") ||
        currentTrip.stops[0];
      if (activeStop?.id) realTripStopId = activeStop.id;
    }
  } else if (
    trip_id &&
    !isNaN(parseInt(trip_id, 10)) &&
    parseInt(trip_id, 10) > 0
  ) {
    // Nếu tài xế chưa có chuyến In Progress nhưng request truyền trip_id cụ thể hợp lệ
    realTripId = parseInt(trip_id, 10);
  } else {
    // Fallback: Tìm chuyến được gán gần đây nhất của tài xế trong bảng trip_drivers
    const latestAssignment = await prisma.trip_drivers.findFirst({
      where: { driver_id: BigInt(profile.id) },
      select: {
        trip_id: true,
        trips: { select: { id: true, trip_code: true, status: true } },
      },
      orderBy: { id: "desc" },
    });

    if (latestAssignment && latestAssignment.trip_id) {
      realTripId = Number(latestAssignment.trip_id);
      currentTrip = serializePrisma(latestAssignment.trips) || null;
    } else {
      // Nếu tài xế chưa từng được phân công chuyến nào, lấy chuyến mới nhất trong hệ thống
      const fallbackTrip = await prisma.trips.findFirst({
        select: { id: true, trip_code: true, status: true },
        orderBy: { id: "desc" },
      });
      realTripId = fallbackTrip ? Number(fallbackTrip.id) : 1;
      currentTrip = serializePrisma(fallbackTrip) || null;
    }
  }

  let resolvedLat =
    incident_lat !== null &&
    incident_lat !== undefined &&
    !isNaN(Number(incident_lat))
      ? Number(incident_lat)
      : null;
  let resolvedLng =
    incident_lng !== null &&
    incident_lng !== undefined &&
    !isNaN(Number(incident_lng))
      ? Number(incident_lng)
      : null;

  if (
    (resolvedLat === null || resolvedLng === null) &&
    currentTrip?.stops?.length > 0
  ) {
    const targetStop =
      currentTrip.stops.find((s) => Number(s.id) === Number(realTripStopId)) ||
      currentTrip.stops[0];
    if (targetStop?.location?.latitude && targetStop?.location?.longitude) {
      resolvedLat = Number(targetStop.location.latitude);
      resolvedLng = Number(targetStop.location.longitude);
    }
  }

  if ((resolvedLat === null || resolvedLng === null) && realTripId) {
    const stopGeo = await prisma.trip_stops.findFirst({
      where: { trip_id: BigInt(realTripId) },
      select: {
        id: true,
        locations: { select: { latitude: true, longitude: true } },
      },
      orderBy: { sequence: "asc" },
    });
    const loc = stopGeo?.locations;
    if (loc?.latitude && loc?.longitude) {
      resolvedLat = Number(loc.latitude);
      resolvedLng = Number(loc.longitude);
    }
  }

  let resolvedPhotos = photos;
  if (Array.isArray(photos)) {
    resolvedPhotos = await Promise.all(
      photos.map((p) =>
        cloudinaryService.uploadDataUriIfNeeded(p, "nexlog/incidents"),
      ),
    );
  } else if (typeof photos === "string" && photos.trim()) {
    resolvedPhotos = await cloudinaryService.uploadDataUriIfNeeded(
      photos,
      "nexlog/incidents",
    );
  }

  const newIncident = await driverModel.createIncident({
    tripId: realTripId,
    tripStopId: realTripStopId,
    reportedBy: profile.id,
    type,
    description: description.trim(),
    photos: resolvedPhotos,
    incidentLat: resolvedLat,
    incidentLng: resolvedLng,
  });

  const tripCodeDisplay = currentTrip?.trip_code || `TRIP-${realTripId}`;

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "REPORT_INCIDENT",
    targetType: "INCIDENT",
    targetId: newIncident?.id || 0,
    reason: `Tài xế báo cáo sự cố [${type}] trên chuyến xe [${tripCodeDisplay}]: ${description.trim()}`,
  });

  // Bắn thông báo thời gian thực tới điều phối viên và quản trị viên
  try {
    const dispatchers = await prisma.users.findMany({
      where: { role_id: { in: [1n, 3n] } },
      select: { id: true },
    });

    if (dispatchers && dispatchers.length > 0) {
      for (const d of dispatchers) {
        await driverModel
          .createNotification({
            user_account_id: Number(d.id),
            target_type: "INCIDENT",
            target_id: newIncident?.id,
            message: `Cảnh báo sự cố: Tài xế báo cáo sự cố [${type}] trên chuyến xe [${tripCodeDisplay}]. Cần kiểm tra ngay!`,
          })
          .catch(() => {});
      }
    }
  } catch (notifyErr) {
    console.warn(
      "Could not notify dispatchers about incident:",
      notifyErr.message,
    );
  }

  return {
    success: true,
    message: `Đã báo sự cố trên chuyến ${tripCodeDisplay}. Điều phối viên đã được thông báo!`,
    incident: {
      ...newIncident,
      trip_id: realTripId,
      trip_code: tripCodeDisplay,
    },
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
    clientActionId = null,
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
    const error = new Error(
      "Vui lòng chụp ảnh hiện trường hàng hóa bị từ chối",
    );
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

  const resolvedCargoPhoto = await cloudinaryService.uploadDataUriIfNeeded(
    cargo_photo.trim(),
    `nexlog/trips/${tripId}/refusal`,
  );

  // 1. Cập nhật đơn hàng sang Delivered (Exception)
  const fullReason =
    note && note.trim()
      ? `${reason.trim()} - Ghi chú: ${note.trim()}`
      : reason.trim();
  await driverModel.updateOrderRefusal(stop.order_id, {
    reason: fullReason,
    photoUrl: resolvedCargoPhoto,
    changedBy: userId,
  });

  // 2. Cập nhật điểm dừng sang Done
  await driverModel.updateTripStop(stopId, {
    status: "Done",
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
      cargo_photo: resolvedCargoPhoto,
    },
  });

  // 4. Tạo thông báo cho Điều phối viên
  const orderCode = stop.order?.order_code || stop.order_id;
  const targetDispatcherIds = [
    ...new Set(
      [trip.created_by, stop.order?.responsible_dispatcher_id]
        .map((id) => (id ? Number(id) : null))
        .filter(Boolean),
    ),
  ];
  for (const dispId of targetDispatcherIds) {
    await driverModel
      .createSystemNotification({
        userAccountId: dispId,
        targetType: "ORDER",
        targetId: stop.order_id,
        message: `Khách không nhận hàng của đơn ${orderCode}. Hãy điều tài xế về kho ALS.`,
      })
      .catch(() => {});
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "CUSTOMER_REFUSAL",
    targetType: "ORDER",
    targetId: stop.order_id,
    reason: `Tài xế báo cáo khách từ chối nhận hàng: ${fullReason}`,
    clientActionId: actionId,
  });

  return {
    success: true,
    message: "Đã ghi nhận khách không nhận hàng.",
  };
};

// ==========================================
// 9. PROPOSE EXTRA FEE
// ==========================================

const proposeExtraFee = async (userId, tripId, feeData) => {
  const { order_id = null, fee_type, amount, reason, photo_url } = feeData;

  const validTypes = ["Bốc xếp thêm", "Nâng hạ", "Trả kho thay khách"];
  if (!fee_type || !validTypes.includes(fee_type)) {
    const error = new Error(
      `Loại phụ phí không hợp lệ. Chỉ chấp nhận: ${validTypes.join(", ")}`,
    );
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
    const error = new Error(
      "Chuyến xe không tồn tại hoặc không thuộc quyền phụ trách",
    );
    error.statusCode = 404;
    throw error;
  }

  const resolvedFeePhoto = await cloudinaryService.uploadDataUriIfNeeded(
    photo_url.trim(),
    `nexlog/trips/${tripId}/extra-fees`,
  );

  const resolvedOrderId =
    order_id
      ? parseInt(order_id, 10)
      : (trip.stops || []).find((s) => s.order_id)?.order_id || null;

  const newFee = await driverModel.createProposedExtraFee({
    tripId,
    orderId: resolvedOrderId,
    feeType: fee_type,
    amount: parsedAmount,
    reason: reason.trim(),
    photoUrl: resolvedFeePhoto,
    recordedBy: userId,
  });

  // Thông báo cho Điều phối viên
  const driverName =
    profile.user?.full_name || profile.user?.username || "Tài xế";
  const orderLabel = order_id ? `đơn #${order_id}` : `chuyến ${trip.trip_code}`;
  const formattedAmount = `${parsedAmount.toLocaleString("vi-VN")} đ`;

  if (trip.created_by) {
    await driverModel.createSystemNotification({
      userAccountId: trip.created_by,
      targetType: "TRIP",
      targetId: tripId,
      message: `Tài xế ${driverName} đề xuất phí ${fee_type} ${formattedAmount} cho ${orderLabel}. Hãy xác nhận hoặc từ chối.`,
    });
  }

  await driverModel.logDriverActivity({
    actorId: userId,
    actorType: "DRIVER",
    action: "PROPOSE_EXTRA_FEE",
    targetType: "TRIP",
    targetId: tripId,
    reason: `Tài xế đề xuất phụ phí: ${fee_type} ${formattedAmount}`,
  });

  return {
    success: true,
    message: `Đã gửi đề xuất phụ phí ${fee_type} ${formattedAmount}. Vui lòng chờ Điều phối viên xác nhận.`,
    extraFee: newFee,
  };
};

module.exports = {
  reportIncident,
  reportCustomerRefusal,
  proposeExtraFee,
};
