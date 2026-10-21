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
// 3. SHIFTS MANAGEMENT (UC-20, BR-60)
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

// ==========================================
// 4. NOTIFICATIONS (Screen 6.5, MSG80)
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
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  reportIncident,
  syncOffline
};

