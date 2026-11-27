const driverService = require("../services/driverService");

// ==========================================
// 1. PROFILE & TRIPS
// ==========================================

const getMyProfile = async (req, res) => {
  try {
    const profile = await driverService.getMyProfile(req.user.id);
    return res.json({ profile });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getActiveTrip = async (req, res) => {
  try {
    const result = await driverService.getActiveTrip(req.user.id);
    return res.json(result);
  } catch (error) {
    console.error("getActiveTrip error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getTripHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await driverService.getTripHistory(req.user.id, { page, limit });
    return res.json(result);
  } catch (error) {
    console.error("getTripHistory error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getTripDetail = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const trip = await driverService.getTripDetail(req.user.id, tripId);
    return res.json({ trip });
  } catch (error) {
    console.error("getTripDetail error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// ==========================================
// 2. WORKFLOW ACTIONS
// ==========================================

const acceptTrip = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const { clientActionId, phoneTime } = req.body;
    const result = await driverService.acceptTrip(req.user.id, tripId, { clientActionId, phoneTime });
    return res.json(result);
  } catch (error) {
    console.error("acceptTrip error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const arriveStop = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    const { phoneLat, phoneLng, phoneTime, clientActionId } = req.body;
    const result = await driverService.arriveAtStop(req.user.id, tripId, stopId, {
      phoneLat,
      phoneLng,
      phoneTime,
      clientActionId
    });
    return res.json(result);
  } catch (error) {
    console.error("arriveStop error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const recordPickup = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    const result = await driverService.recordPickup(req.user.id, tripId, stopId, req.body);
    return res.json(result);
  } catch (error) {
    console.error("recordPickup error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const recordDelivery = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    const result = await driverService.recordDelivery(req.user.id, tripId, stopId, req.body);
    return res.json(result);
  } catch (error) {
    console.error("recordDelivery error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const recordStopEvent = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    const result = await driverService.recordStopEvent(req.user.id, tripId, stopId, req.body);
    return res.json(result);
  } catch (error) {
    console.error("recordStopEvent error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const reportCustomerRefusal = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const stopId = parseInt(req.params.stopId);
    const result = await driverService.reportCustomerRefusal(req.user.id, tripId, stopId, req.body);
    return res.json(result);
  } catch (error) {
    console.error("reportCustomerRefusal error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const proposeExtraFee = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);
    const result = await driverService.proposeExtraFee(req.user.id, tripId, req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error("proposeExtraFee error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// ==========================================
// 3. SHIFTS MANAGEMENT
// ==========================================

const getMyShifts = async (req, res) => {
  try {
    const { from, to } = req.query;
    const shifts = await driverService.getMyShifts(req.user.id, { from, to });
    return res.json({ shifts });
  } catch (error) {
    console.error("getMyShifts error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const registerShift = async (req, res) => {
  try {
    const result = await driverService.registerShift(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error("registerShift error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const cancelShift = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await driverService.cancelShift(req.user.id, id);
    return res.json(result);
  } catch (error) {
    console.error("cancelShift error:", error);
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
};

// ==========================================
// 4. NOTIFICATIONS
// ==========================================

const getDriverNotifications = async (req, res) => {
  try {
    const notifications = await driverService.getDriverNotifications(req.user.id);
    return res.json({ notifications });
  } catch (error) {
    console.error("getDriverNotifications error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const result = await driverService.markNotificationRead(req.user.id, req.params.id);
    return res.json({ success: true, notification: result });
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await driverService.markAllNotificationsRead(req.user.id);
    return res.json({ success: true, count: result?.length || 0 });
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// ==========================================
// 5. INCIDENTS & OFFLINE SYNC
// ==========================================

const reportIncident = async (req, res) => {
  try {
    const result = await driverService.reportIncident(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error("reportIncident error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const syncOffline = async (req, res) => {
  try {
    const { actions } = req.body;
    const result = await driverService.syncOfflineActions(req.user.id, actions);
    return res.json(result);
  } catch (error) {
    console.error("syncOffline error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};


const getSyncLogDetail = async (req, res) => {
  try {
    const logId = req.params.id;
    const log = await driverService.getSyncLogDetail(req.user.id, logId);
    return res.json({ success: true, log });
  } catch (error) {
    console.error("getSyncLogDetail error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const getMyLeaveRequests = async (req, res) => {
  try {
    const result = await driverService.getMyLeaveRequests(req.user.id);
    return res.json(result);
  } catch (error) {
    console.error("getMyLeaveRequests error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

const submitLeaveRequest = async (req, res) => {
  try {
    const result = await driverService.submitSuddenLeaveRequest(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error("submitLeaveRequest error:", error);
    return res.status(error.statusCode || 400).json({ message: error.message });
  }
};

const prisma = require("../config/prisma");

const updateDeviceGps = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy = null,
      altitude = null,
      heading = null,
      speed = null,
      timestamp = null,
      trip_id = null,
    } = req.body || {};

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        message: "Tọa độ GPS không hợp lệ (latitude/longitude).",
      });
    }

    const recordedTime = timestamp ? new Date(timestamp) : new Date();
    const validTime = Number.isNaN(recordedTime.getTime())
      ? new Date()
      : recordedTime;

    // 1. Tìm chuyến xe hiện tại của tài xế (ưu tiên trip_id truyền lên, nếu không lấy chuyến đang hoạt động gần nhất)
    let trip = null;
    const includeTruck = {
      trip_trucks: {
        where: { released_time: null },
        include: { trucks: { select: { id: true, plate_number: true } } },
        take: 1,
      },
    };

    if (trip_id && /^\d+$/.test(String(trip_id).trim())) {
      trip = await prisma.trips.findFirst({
        where: { id: BigInt(String(trip_id).trim()) },
        include: includeTruck,
      });
    }

    if (!trip && req.user?.id) {
      const driverRow = await prisma.drivers.findFirst({
        where: { user_id: BigInt(Number(req.user.id)) },
        select: { id: true },
      });

      if (driverRow) {
        trip = await prisma.trips.findFirst({
          where: {
            driver_id: driverRow.id,
            status: { notIn: ["Completed", "Cancelled", "CLOSED"] },
          },
          orderBy: { updated_at: "desc" },
          include: includeTruck,
        });
      }
    }

    const tripId = trip?.id ? Number(trip.id) : null;
    const tripCode = trip?.trip_code || null;
    const truckId = trip?.trip_trucks?.[0]?.truck_id
      ? Number(trip.trip_trucks[0].truck_id)
      : null;
    const truckPlate = trip?.trip_trucks?.[0]?.trucks?.plate_number || null;

    // 2. Lưu điểm GPS thực vào trip_track_points và cập nhật vị trí xe trucks để bản đồ Điều phối hiển thị ngay
    const dbOps = [];
    if (tripId) {
      dbOps.push(
        prisma.trip_track_points.create({
          data: {
            trip_id: BigInt(tripId),
            latitude: lat,
            longitude: lng,
            recorded_time: validTime,
          },
        }),
      );
    }
    if (truckId) {
      dbOps.push(
        prisma.trucks.update({
          where: { id: BigInt(truckId) },
          data: {
            last_lat: lat,
            last_lng: lng,
            last_located_at: validTime,
            updated_at: new Date(),
          },
        }),
      );
    }
    if (dbOps.length > 0) {
      await Promise.all(dbOps);
    }

    return res.json({
      success: true,
      synced_to_map: Boolean(truckId || tripId),
      trip_id: tripId,
      trip_code: tripCode,
      truck_id: truckId,
      truck_plate: truckPlate,
      gps: {
        latitude: lat,
        longitude: lng,
        accuracy: accuracy !== null ? Number(accuracy) : null,
        altitude: altitude !== null ? Number(altitude) : null,
        heading: heading !== null ? Number(heading) : null,
        speed: speed !== null ? Number(speed) : null,
        timestamp: validTime.toISOString(),
      },
    });
  } catch (error) {
    console.error("updateDeviceGps error:", error);
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Lỗi cập nhật GPS thiết bị" });
  }
};

module.exports = {
  getMyProfile,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  acceptTrip,
  arriveStop,
  recordStopEvent,
  recordPickup,
  recordDelivery,
  reportCustomerRefusal,
  proposeExtraFee,
  getMyShifts,
  registerShift,
  cancelShift,
  getMyLeaveRequests,
  submitLeaveRequest,
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  reportIncident,
  syncOffline,
  getSyncLogDetail,
  updateDeviceGps,
};

