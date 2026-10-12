const express = require("express");
const { 
    getDashboardStats, 
    getVehicles, 
    getOrders, 
    getVendors, 
    getApprovals 
} = require("../controllers/managerController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền MANAGER hoặc ADMIN
router.use(requireAuth);
router.use(requireRole(["MANAGER", "ADMINISTRATOR", "ADMIN"]));

// API Routes
router.get("/dashboard/stats", getDashboardStats);
router.get("/vehicles", getVehicles);
router.get("/orders", getOrders);
router.get("/vendors", getVendors);
router.get("/approvals", getApprovals);

module.exports = router;
