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

// API Routes
router.get("/dashboard/stats", getDashboardStats);

router.get("/vehicles", getVehicles);
router.post("/drivers", createDriver);

router.get("/orders", getOrders);
router.patch("/orders/:id/reassign", reassignOrder);

router.get("/vendors", getVendors);
router.patch("/vendors/:id/approve", approveVendor);

router.get("/approvals", getApprovals);
router.post("/approvals/:id/decide", decideApproval);

router.get("/blogs", getBlogs);
router.post("/blogs", createBlog);
router.put("/blogs/:id", updateBlog);
router.patch("/blogs/:id/approve", approveBlog);
router.delete("/blogs/:id", deleteBlog);

// NHÓM 1: ACCOUNTS (Manage Dispatcher & Driver Accounts - Screen 26 & Screen 27)
router.get("/accounts", staffAccountController.getStaffAccounts);
router.get("/accounts/:id", staffAccountController.getStaffAccountDetail);
router.post("/accounts", staffAccountController.createStaffAccount);
router.put("/accounts/:id", staffAccountController.updateStaffAccount);
router.patch("/accounts/:id/status", staffAccountController.updateAccountStatus);

module.exports = router;
