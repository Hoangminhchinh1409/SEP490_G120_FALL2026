const shiftModel = require("./shiftModel");
const notificationModel = require("./notificationModel");
const driverTripModel = require("./driver/driverTripModel");
const driverStopEventModel = require("./driver/driverStopEventModel");
const driverIncidentFeeModel = require("./driver/driverIncidentFeeModel");

module.exports = {
  ...driverTripModel,
  ...driverStopEventModel,
  ...driverIncidentFeeModel,
  ...shiftModel,
  ...notificationModel,
};
