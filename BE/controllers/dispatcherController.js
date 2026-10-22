/**
 * Dispatcher Controller Barrel Export
 * Phân chia trách nhiệm các luồng nghiệp vụ Điều phối viên (Dispatcher):
 * - Fleet Management (Trucks, Drivers, Vendors): BE/controllers/dispatcher/dispatcherFleetController.js
 * - Locations (Kho bãi, điểm giao nhận): BE/controllers/dispatcher/dispatcherLocationController.js
 * - Contracts & Customers (Hợp đồng nguyên tắc, khách hàng): BE/controllers/dispatcher/dispatcherContractController.js
 * - Trips & Incidents (Lập chuyến, điều xe, sự cố): BE/controllers/dispatcher/dispatcherTripController.js
 * - Dashboard & Routing (Thống kê, OSRM routing): BE/controllers/dispatcher/dispatcherDashboardController.js
 */

const {
  getTruckModelName,
  getTruckCategory,
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors
} = require('./dispatcher/dispatcherFleetController');

const {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation
} = require('./dispatcher/dispatcherLocationController');

const {
  getAllContracts,
  createContract,
  getAllCustomers
} = require('./dispatcher/dispatcherContractController');

const {
  getAllTrips,
  createTrip,
  updateTripStatus,
  getAllIncidents,
  createIncident,
  updateIncidentStatus
} = require('./dispatcher/dispatcherTripController');

const {
  getDispatcherDashboardStats,
  calculateRoadRoute
} = require('./dispatcher/dispatcherDashboardController');

module.exports = {
  // Helpers
  getTruckModelName,
  getTruckCategory,

  // Fleet
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,

  // Locations
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,

  // Contracts
  getAllContracts,
  createContract,
  getAllCustomers,

  // Trips & Incidents
  getAllTrips,
  createTrip,
  updateTripStatus,
  getAllIncidents,
  createIncident,
  updateIncidentStatus,

  // Dashboard & Routing
  getDispatcherDashboardStats,
  calculateRoadRoute
};
