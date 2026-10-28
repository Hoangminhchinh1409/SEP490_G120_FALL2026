const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

const fleetController = require('../controllers/fleetController');
const oversightController = require('../controllers/oversightController');
const incidentController = require('../controllers/incidentController');
const tripController = require('../controllers/tripController');
const contractController = require('../controllers/contractController');
const locationController = require('../controllers/locationController');
const blogController = require('../controllers/blogController');

const router = express.Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền MANAGER hoặc ADMIN
router.use(requireAuth);
router.use(requireRole(['MANAGER', 'ADMINISTRATOR', 'ADMIN']));

// NHÓM 1: FLEET, DRIVERS, SHIFTS & STAFF ACCOUNTS (UC-17, UC-18, UC-19, UC-20)
router.get('/accounts', fleetController.getStaffAccounts);
router.get('/accounts/:id', fleetController.getStaffAccountDetail);
router.post('/accounts', fleetController.createStaffAccount);
router.put('/accounts/:id', fleetController.updateStaffAccount);
router.patch('/accounts/:id/status', fleetController.updateAccountStatus);

router.get('/vehicles', fleetController.getVehicles);
router.get('/trucks', fleetController.getVehicles);
router.post('/trucks', fleetController.createTruck);
router.put('/trucks/:id', fleetController.updateTruck);
router.patch('/trucks/:id/status', fleetController.updateTruckStatus);
router.delete('/trucks/:id', fleetController.deleteTruck);

router.post('/drivers', fleetController.createDriver);
router.put('/drivers/:id', fleetController.updateDriverProfile);

router.get('/shifts', fleetController.getShifts);
router.post('/shifts', fleetController.createShift);
router.patch('/shifts/:id/approve', fleetController.approveShift);
router.patch('/shifts/:id/reject', fleetController.rejectShift);
router.delete('/shifts/:id', fleetController.deleteShift);

// NHÓM 2: MANAGER OVERSIGHT — WORKLOAD, REASSIGN, DASHBOARD & DRIVER PERFORMANCE (UC-21, UC-22, UC-27, UC-43)
router.get('/orders', oversightController.getOrderWorkload);
router.get('/orders/workload', oversightController.getOrderWorkload);
router.get('/orders/:id', oversightController.getOrderDetailReadOnly);
router.patch('/orders/:id/reassign', oversightController.reassignOrder);

router.get('/dashboard/stats', oversightController.getDashboardStats);
router.get('/drivers/performance', oversightController.getDriverPerformance);

// NHÓM 3: MAJOR INCIDENTS & COMPENSATION CLAIMS (UC-25, UC-26)
router.get('/incidents', incidentController.getIncidents);
router.get('/incidents/:id', incidentController.getIncidentById);
router.post('/incidents/:id/resolve', incidentController.resolveIncident);

router.get('/claims', incidentController.getClaims);
router.post('/claims/:id/decide', incidentController.decideClaim);
router.get('/approvals', incidentController.getApprovals);
router.post('/approvals/:id/decide', incidentController.decideApproval);

// NHÓM 4: TRIP REPLAY (UC-42)
router.get('/trips/:id/replay', tripController.getTripReplay);

// NHÓM 5: VENDORS & TRANSPORT CONTRACTS (UC-23, UC-24)
router.get('/vendors', contractController.getVendors);
router.get('/vendors/:id', contractController.getVendorById);
router.post('/vendors', contractController.createVendor);
router.put('/vendors/:id', contractController.updateVendor);
router.patch('/vendors/:id/status', contractController.updateVendorStatus);
router.patch('/vendors/:id/approve', contractController.approveVendor);
router.get('/contracts', contractController.getContracts);

// NHÓM 6: LOCATIONS READ-ONLY (UC-40)
router.get('/locations', locationController.getLocations);

// NHÓM 7: WEBSITE NEWS MANAGEMENT (UC-44)
router.get('/blogs', blogController.getBlogs);
router.get('/blogs/:id', blogController.getBlogById);
router.post('/blogs', blogController.createBlog);
router.put('/blogs/:id', blogController.updateBlog);
router.patch('/blogs/:id/status', blogController.updateBlogStatus);
router.patch('/blogs/:id/approve', blogController.approveBlog);
router.delete('/blogs/:id', blogController.deleteBlog);

module.exports = router;
