/**
 * Driver Service — Aggregator giữ nguyên toàn bộ exports cho Driver PWA & Controllers
 */
const {
  getMyProfile,
  getActiveTrip,
  getTripHistory,
  getTripDetail,
  getDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("./driver/driverHelper");

const {
  acceptTrip,
  arriveAtStop,
  recordStopEvent,
  recordPickup,
  recordDelivery,
} = require("./driver/driverTripExecutionService");

const {
  reportIncident,
  reportCustomerRefusal,
  proposeExtraFee,
} = require("./driver/driverIncidentFeeService");

const {
  getMyShifts,
  registerShift,
  cancelShift,
  getMyLeaveRequests,
  submitSuddenLeaveRequest,
} = require("./driver/driverShiftLeaveService");

const {
  syncOfflineActions,
  getSyncLogDetail,
} = require("./driver/driverOfflineSyncService");

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
  getSyncLogDetail,
};
