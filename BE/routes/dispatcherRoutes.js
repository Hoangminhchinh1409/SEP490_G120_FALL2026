const express = require('express');
const router = express.Router();
const dispatcherController = require('../controllers/dispatcherController');

// Fleet
router.get('/fleet/trucks', dispatcherController.getFleetTrucks);
router.post('/fleet/trucks', dispatcherController.createFleetTruck);
router.patch('/fleet/trucks/:id', dispatcherController.updateFleetTruck);
router.get('/fleet/drivers', dispatcherController.getFleetDrivers);
router.patch('/fleet/drivers/:id', dispatcherController.updateFleetDriver);
router.get('/fleet/vendors', dispatcherController.getFleetVendors);

// Locations
router.get('/locations', dispatcherController.getAllLocations);
router.post('/locations', dispatcherController.createLocation);
router.put('/locations/:id', dispatcherController.updateLocation);
router.delete('/locations/:id', dispatcherController.deleteLocation);

// Contracts
router.get('/contracts', dispatcherController.getAllContracts);
router.post('/contracts', dispatcherController.createContract);
router.get('/customers', dispatcherController.getAllCustomers);

// Trips & Planning
router.get('/trips', dispatcherController.getAllTrips);
router.post('/trips', dispatcherController.createTrip);
router.patch('/trips/:id/status', dispatcherController.updateTripStatus);

// Incidents
router.get('/incidents', dispatcherController.getAllIncidents);
router.post('/incidents', dispatcherController.createIncident);
router.patch('/incidents/:id/status', dispatcherController.updateIncidentStatus);

// Dashboard
router.get('/dashboard-stats', dispatcherController.getDispatcherDashboardStats);

// Routing
router.get('/routing/road-route', dispatcherController.calculateRoadRoute);

module.exports = router;
