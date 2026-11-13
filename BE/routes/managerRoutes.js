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

const MANAGER_CROSS_ROLE_PERMS = ['FLEET_MANAGE', 'DRIVER_SHIFT_MANAGE', 'VENDOR_MANAGE', 'INCIDENT_MANAGE', 'NEWS_MANAGE'];

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền MANAGER, ADMIN hoặc các role được cấp quyền xem chéo
router.use(requireAuth);
router.use(requireRole(['MANAGER', 'ADMINISTRATOR', 'ADMIN', 1, 2], MANAGER_CROSS_ROLE_PERMS));

const requireManagerOrAdmin = requireRole(['MANAGER', 'ADMINISTRATOR', 'ADMIN', 1, 2]);

// NHÓM 1: FLEET, DRIVERS, SHIFTS & STAFF ACCOUNTS
router.get('/accounts', fleetController.getStaffAccounts);
router.get('/accounts/:id', fleetController.getStaffAccountDetail);
router.post('/accounts', requireManagerOrAdmin, fleetController.createStaffAccount);
router.put('/accounts/:id', requireManagerOrAdmin, fleetController.updateStaffAccount);
router.patch('/accounts/:id/status', requireManagerOrAdmin, fleetController.updateAccountStatus);

router.get('/vehicles', fleetController.getVehicles);
router.get('/trucks', fleetController.getVehicles);
router.post('/trucks', requireManagerOrAdmin, fleetController.createTruck);
router.put('/trucks/:id', requireManagerOrAdmin, fleetController.updateTruck);
router.patch('/trucks/:id/status', requireManagerOrAdmin, fleetController.updateTruckStatus);
router.delete('/trucks/:id', requireManagerOrAdmin, fleetController.deleteTruck);

router.post('/drivers', requireManagerOrAdmin, fleetController.createDriver);
router.put('/drivers/:id', requireManagerOrAdmin, fleetController.updateDriverProfile);

router.get('/shifts', fleetController.getShifts);
router.post('/shifts/auto-assign', requireManagerOrAdmin, fleetController.autoAssignNextWeekShifts);
router.post('/shifts/send-reminders', requireManagerOrAdmin, fleetController.sendShiftReminders);
router.patch('/shifts/week-approve', requireManagerOrAdmin, fleetController.approveDriverWeekShifts);
router.patch('/shifts/week-switch', requireManagerOrAdmin, fleetController.switchDriverWeekShiftType);
router.post('/shifts', requireManagerOrAdmin, fleetController.createShift);
router.put('/shifts/:id', requireManagerOrAdmin, fleetController.updateShift);
router.patch('/shifts/:id/approve', requireManagerOrAdmin, fleetController.approveShift);
router.patch('/shifts/:id/reject', requireManagerOrAdmin, fleetController.rejectShift);
router.delete('/shifts/:id', requireManagerOrAdmin, fleetController.deleteShift);
router.get('/leave-requests', fleetController.getLeaveRequests);
router.patch('/leave-requests/:id/decide', requireManagerOrAdmin, fleetController.decideLeaveRequest);

// NHÓM 2: MANAGER OVERSIGHT — WORKLOAD, REASSIGN, DASHBOARD & DRIVER PERFORMANCE
router.get('/orders', oversightController.getOrderWorkload);
router.get('/orders/workload', oversightController.getOrderWorkload);
router.get('/orders/:id', oversightController.getOrderDetailReadOnly);
router.patch('/orders/:id/reassign', requireManagerOrAdmin, oversightController.reassignOrder);

router.get('/dashboard/stats', oversightController.getDashboardStats);
router.get('/dashboard/overview', oversightController.getDashboardStats);
router.get('/drivers/performance', oversightController.getDriverPerformance);

// NHÓM 3: MAJOR INCIDENTS & COMPENSATION CLAIMS
router.get('/incidents', incidentController.getIncidents);
router.get('/incidents/:id', incidentController.getIncidentById);
router.post('/incidents/:id/resolve', requireManagerOrAdmin, incidentController.resolveIncident);
router.patch('/incidents/:id/close', requireManagerOrAdmin, incidentController.resolveIncident);

router.get('/claims', incidentController.getClaims);
router.post('/claims/:id/decide', requireManagerOrAdmin, incidentController.decideClaim);
router.get('/approvals', incidentController.getApprovals);
router.post('/approvals/:id/decide', requireManagerOrAdmin, incidentController.decideApproval);

// NHÓM 4: TRIP REPLAY
router.get('/trips/:id/replay', tripController.getTripReplay);

// NHÓM 5: VENDORS & TRANSPORT CONTRACTS
router.get('/vendors', contractController.getVendors);
router.get('/vendors/:id', contractController.getVendorById);
router.post('/vendors', requireManagerOrAdmin, contractController.createVendor);
router.put('/vendors/:id', requireManagerOrAdmin, contractController.updateVendor);
router.patch('/vendors/:id/status', requireManagerOrAdmin, contractController.updateVendorStatus);
router.patch('/vendors/:id/approve', requireManagerOrAdmin, contractController.approveVendor);
router.get('/contracts', contractController.getContracts);

// NHÓM 6: LOCATIONS READ-ONLY
router.get('/locations', locationController.getLocations);

// NHÓM 7: WEBSITE NEWS MANAGEMENT
router.get('/blogs', blogController.getBlogs);
router.get('/blogs/:id', blogController.getBlogById);
router.post('/blogs', requireManagerOrAdmin, blogController.createBlog);
router.put('/blogs/:id', requireManagerOrAdmin, blogController.updateBlog);
router.patch('/blogs/:id/status', requireManagerOrAdmin, blogController.updateBlogStatus);
router.patch('/blogs/:id/approve', requireManagerOrAdmin, blogController.approveBlog);
router.delete('/blogs/:id', requireManagerOrAdmin, blogController.deleteBlog);

module.exports = router;
