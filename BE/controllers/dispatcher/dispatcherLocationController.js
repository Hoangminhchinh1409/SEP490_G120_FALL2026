// Delegate to Modular Locations Controller
const locationController = require('../../src/modules/locations/locations.controller');

module.exports = {
  getAllLocations: (req, res) => locationController.getAllLocations(req, res),
  createLocation: (req, res) => locationController.createLocation(req, res),
  updateLocation: (req, res) => locationController.updateLocation(req, res),
  deleteLocation: (req, res) => locationController.deleteLocation(req, res)
};