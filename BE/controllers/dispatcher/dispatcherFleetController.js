// Delegate to Modular Fleet Controller
const fleetController = require('../../src/modules/fleet/fleet.controller');
const fleetService = require('../../src/modules/fleet/fleet.service');

module.exports = {
  getTruckModelName: (payload) => fleetService.getTruckModelName(payload),
  getTruckCategory: (payload) => fleetService.getTruckCategory(payload),
  getFleetTrucks: (req, res) => fleetController.getFleetTrucks(req, res),
  createFleetTruck: (req, res) => fleetController.createFleetTruck(req, res),
  updateFleetTruck: (req, res) => fleetController.updateFleetTruck(req, res),
  getFleetDrivers: (req, res) => fleetController.getFleetDrivers(req, res),
  updateFleetDriver: (req, res) => fleetController.updateFleetDriver(req, res),
  getFleetVendors: (req, res) => fleetController.getFleetVendors(req, res)
};