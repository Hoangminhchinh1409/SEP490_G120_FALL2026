// Delegate to Modular Trips & Incidents Controllers
const tripController = require('../../src/modules/trips/trips.controller');
const incidentController = require('../../src/modules/incidents/incidents.controller');

module.exports = {
  getAllTrips: (req, res) => tripController.getAllTrips(req, res),
  createTrip: (req, res) => tripController.createTrip(req, res),
  updateTripStatus: (req, res) => tripController.updateTripStatus(req, res),
  getAllIncidents: (req, res) => incidentController.getAllIncidents(req, res),
  createIncident: (req, res) => incidentController.createIncident(req, res),
  updateIncidentStatus: (req, res) => incidentController.updateIncidentStatus(req, res)
};