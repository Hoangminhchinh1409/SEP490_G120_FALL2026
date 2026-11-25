const driverModel = require("../../models/driverModel");

// Helper chuẩn hóa điểm lấy hàng (Pickup) hay điểm giao hàng (Drop-off)
const isPickupStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.raw_stop_type || stop.stop_type || stop.type || "")
    .trim()
    .toUpperCase();
  if (raw === "PICKUP" || raw === "LẤY HÀNG" || raw === "LAY HANG") return true;
  if (
    raw === "DROPOFF" ||
    raw === "DROP-OFF" ||
    raw === "DROP_OFF" ||
    raw === "DELIVERY" ||
    raw === "GIAO HÀNG" ||
    raw === "GIAO HANG" ||
    raw === "RETURN" ||
    raw === "RETURN_TO_WAREHOUSE" ||
    raw === "HOÀN KHO" ||
    raw === "REST" ||
    raw === "TRANSIT"
  ) {
    return false;
  }
  return stop.sequence === 1;
};

const isReturnWarehouseStop = (stop) => {
  if (!stop) return false;
  const raw = String(stop.raw_stop_type || stop.stop_type || stop.type || "")
    .trim()
    .toUpperCase();
  if (raw === "RETURN" || raw === "RETURN_TO_WAREHOUSE" || raw === "HOÀN KHO") {
    return true;
  }
  const ordStatus = String(stop.order?.status || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return !isPickupStop(stop) && ordStatus === "DELIVERED_EXCEPTION";
};

const isDropoffStop = (stop) => {
  if (!stop) return false;
  return !isPickupStop(stop);
};

// Kiểm tra độ lệch đồng hồ (BR-27)
const validatePhoneTime = (phoneTime) => {
  const now = Date.now();
  if (!phoneTime)
    return { time: new Date(now).toISOString(), timeFlagged: false };
  const clientTs = new Date(phoneTime).getTime();
  const driftMinutes = (clientTs - now) / 60000;
  // BR-27: Nếu phone_time vượt quá 5 phút so với đồng hồ server hoặc quá 24h trong quá khứ
  if (driftMinutes > 5 || driftMinutes < -1440) {
    return { time: new Date(now).toISOString(), timeFlagged: true };
  }
  return { time: new Date(clientTs).toISOString(), timeFlagged: false };
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
  const { weekStart: currentMondayStr, weekEnd: currentSundayStr } =
    getMondaySundayOfDate(todayStr);
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
  const rawType = String(shift_type || "")
    .trim()
    .toUpperCase();
  if (rawType === "MORNING" || rawType === "CA_SANG" || rawType === "DAY")
    return "MORNING";
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

// ==========================================
// 1. PROFILE, OVERVIEW & NOTIFICATIONS
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
    drivingHours,
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
      drivingHours: profile.drivingHours,
    };
  }

  // Xác định điểm dừng kế tiếp cần thực hiện (điểm dừng chưa hoàn thành 'Done')
  let currentStop = null;
  if (trip && trip.stops && trip.stops.length > 0) {
    currentStop =
      trip.stops.find((s) => s.status !== "Done") ||
      trip.stops[trip.stops.length - 1];
  }

  return {
    hasActiveTrip: Boolean(trip),
    trip,
    upcomingTrips,
    currentStop,
    drivingHours: profile.drivingHours,
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
    const error = new Error(
      "Không tìm thấy chuyến xe hoặc bạn không có quyền truy cập",
    );
    error.statusCode = 404;
    throw error;
  }
  return trip;
};

const getDriverNotifications = async (userId) => {
  return await driverModel.getDriverNotifications(userId);
};

const markNotificationRead = async (userId, notificationId) => {
  return await driverModel.markNotificationAsRead(
    parseInt(notificationId, 10),
    userId,
  );
};

const markAllNotificationsRead = async (userId) => {
  return await driverModel.markAllNotificationsAsRead(userId);
};

module.exports = {
  isPickupStop,
  isReturnWarehouseStop,
  isDropoffStop,
  validatePhoneTime,
  addDaysStr,
  getMondaySundayOfDate,
  getNowGMT7Info,
  normalizeWeeklyShiftType,
  getMyProfile,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
