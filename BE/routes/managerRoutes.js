const express = require("express");
const { 
    getDashboardStats, 
    getVehicles, 
    createDriver,
    getOrders, 
    reassignOrder,
    getVendors, 
    approveVendor,
    getApprovals,
    decideApproval,
    getBlogs,
    createBlog,
    updateBlog,
    approveBlog,
    deleteBlog
} = require("../controllers/managerController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền MANAGER hoặc ADMIN
router.use(requireAuth);
router.use(requireRole(["MANAGER", "ADMINISTRATOR", "ADMIN"]));

const staffAccountController = require("../controllers/staffAccountController");
const managerFleetController = require("../controllers/manager/managerFleetController");
const managerShiftController = require("../controllers/manager/managerShiftController");
const managerOrderController = require("../controllers/manager/managerOrderController");
const managerIncidentController = require("../controllers/manager/managerIncidentController");
const managerDashboardController = require("../controllers/manager/managerDashboardController");

// NHÓM 5: REPORTING & DRIVER PERFORMANCE (UC-27 V2, UC-43 V2 - Screen 16 & Screen 41)
router.get("/dashboard/stats", managerDashboardController.getDashboardStats);
router.get("/drivers/performance", managerDashboardController.getDriverPerformance);

// NHÓM 2: FLEET & DRIVERS (UC-18, UC-19)
router.get("/vehicles", managerFleetController.getVehicles);
router.get("/trucks", managerFleetController.getVehicles);
router.post("/trucks", managerFleetController.createTruck);
router.put("/trucks/:id", managerFleetController.updateTruck);
router.patch("/trucks/:id/status", managerFleetController.updateTruckStatus);
router.delete("/trucks/:id", managerFleetController.deleteTruck);

router.post("/drivers", managerFleetController.createDriver);
router.put("/drivers/:id", managerFleetController.updateDriverProfile);

// NHÓM 2: DRIVER SHIFTS (UC-20 V2 - Screen 25)
router.get("/shifts", managerShiftController.getShifts);
router.post("/shifts", managerShiftController.createShift);
router.patch("/shifts/:id/approve", managerShiftController.approveShift);
router.patch("/shifts/:id/reject", managerShiftController.rejectShift);
router.delete("/shifts/:id", managerShiftController.deleteShift);

// NHÓM 3: ORDER WORKLOAD & REASSIGN (UC-21, UC-22 V2 - Screen 18 & Screen 09)
router.get("/orders", managerOrderController.getOrderWorkload);
router.get("/orders/workload", managerOrderController.getOrderWorkload);
router.get("/orders/:id", managerOrderController.getOrderDetailReadOnly);
router.patch("/orders/:id/reassign", managerOrderController.reassignOrder);

// NHÓM 4: MAJOR INCIDENTS, CLAIMS & TRIP REPLAY (UC-25, UC-26 V2, UC-42 - Screen 17, 14, 19, 20, 40)
router.get("/incidents", managerIncidentController.getIncidents);
router.get("/incidents/:id", managerIncidentController.getIncidentById);
router.post("/incidents/:id/resolve", managerIncidentController.resolveIncident);

router.get("/claims", managerIncidentController.getClaims);
router.post("/claims/:id/decide", managerIncidentController.decideClaim);

// Trip Replay (Screen 40)
router.get("/trips/:id/replay", managerIncidentController.getTripReplay);

// Legacy approval aliases
router.get("/approvals", managerIncidentController.getClaims);
router.post("/approvals/:id/decide", managerIncidentController.decideClaim);

const managerVendorController = require("../controllers/manager/managerVendorController");

// NHÓM 6: VENDORS & CONTRACTS (UC-23 - Screen 28, 29, 30, 31, 37)
router.get("/vendors", managerVendorController.getVendors);
router.get("/vendors/:id", managerVendorController.getVendorById);
router.post("/vendors", managerVendorController.createVendor);
router.put("/vendors/:id", managerVendorController.updateVendor);
router.patch("/vendors/:id/status", managerVendorController.updateVendorStatus);
router.patch("/vendors/:id/approve", (req, res) => {
  req.body = { ...req.body, status: 'APPROVED' };
  return managerVendorController.updateVendorStatus(req, res);
});

// Tra cứu Hợp đồng & Địa điểm Read-only (Screen 30, 31, 37)
router.get("/contracts", managerVendorController.getContracts);
router.get("/locations", managerVendorController.getLocations);

const managerBlogController = require("../controllers/manager/managerBlogController");

// NHÓM 7: QUẢN LÝ TIN TỨC WEBSITE (UC-44 - Screen 46 & Screen 47)
router.get("/blogs", managerBlogController.getBlogs);
router.get("/blogs/:id", managerBlogController.getBlogById);
router.post("/blogs", managerBlogController.createBlog);
router.put("/blogs/:id", managerBlogController.updateBlog);
router.patch("/blogs/:id/status", managerBlogController.updateBlogStatus);
router.patch("/blogs/:id/approve", (req, res) => {
  req.body = { ...req.body, status: 'PUBLISHED' };
  return managerBlogController.updateBlogStatus(req, res);
});
router.delete("/blogs/:id", managerBlogController.deleteBlog);

// NHÓM 1: ACCOUNTS (Manage Dispatcher & Driver Accounts - Screen 26 & Screen 27)
router.get("/accounts", staffAccountController.getStaffAccounts);
router.get("/accounts/:id", staffAccountController.getStaffAccountDetail);
router.post("/accounts", staffAccountController.createStaffAccount);
router.put("/accounts/:id", staffAccountController.updateStaffAccount);
router.patch("/accounts/:id/status", staffAccountController.updateAccountStatus);

module.exports = router;
