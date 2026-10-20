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

// ==========================================
// 3. INCIDENTS & OFFLINE SYNC
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
  recordPickup,
  recordDelivery,
  reportIncident,
  syncOffline
};
