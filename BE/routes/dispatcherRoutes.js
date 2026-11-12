const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

const fleetController = require('../controllers/fleetController');

// BUG-ADM-11: Bảo vệ toàn bộ endpoint của Dispatcher với requireAuth & requireRole (chặn khi bật Bảo trì MSG86)
router.use(requireAuth);
router.use(requireRole(['DISPATCHER', 3, 'ADMINISTRATOR', 1, 'MANAGER', 2]));
const locationController = require('../controllers/locationController');
const contractController = require('../controllers/contractController');
const tripController = require('../controllers/tripController');
const incidentController = require('../controllers/incidentController');
const oversightController = require('../controllers/oversightController');

// 1. Fleet & Drivers
router.get('/fleet/trucks', fleetController.getFleetTrucks);
router.post('/fleet/trucks', fleetController.createFleetTruck);
router.patch('/fleet/trucks/:id', fleetController.updateFleetTruck);
router.get('/fleet/drivers', fleetController.getFleetDrivers);
router.patch('/fleet/drivers/:id', fleetController.updateFleetDriver);
router.get('/fleet/vendors', fleetController.getFleetVendors);

// 2. Locations
router.get('/locations', locationController.getAllLocations);
router.post('/locations', locationController.createLocation);
router.put('/locations/:id', locationController.updateLocation);
router.delete('/locations/:id', locationController.deleteLocation);

// 3. Contracts & Customers
router.get('/contracts', contractController.getAllContracts);
router.get('/contracts/documents-bundle', contractController.getOrderDocumentsBundle);
router.post('/contracts', contractController.createContract);
router.get('/customers', contractController.getAllCustomers);

// 4. Trips & Routing
router.get('/trips', tripController.getAllTrips);
router.post('/trips', tripController.createTrip);
router.patch('/trips/:id/status', tripController.updateTripStatus);
router.get('/trips/:id/replay', tripController.getTripReplay);
router.get('/routing/road-route', tripController.calculateRoadRoute);
router.get('/leave-reassignments', tripController.getLeaveReassignments);
router.patch('/trips/:id/reassign-driver', tripController.reassignTripDriver);

// 5. Incidents & Claims (Xem sự cố & khiếu nại bồi thường)
router.get('/incidents', incidentController.getAllIncidents);
router.post('/incidents', incidentController.createIncident);
router.patch('/incidents/:id/status', incidentController.updateIncidentStatus);
router.get('/claims', incidentController.getClaims);
router.get('/approvals', incidentController.getApprovals);

// 6. Dashboard Stats
router.get('/dashboard-stats', oversightController.getDispatcherDashboardStats);

module.exports = router;
