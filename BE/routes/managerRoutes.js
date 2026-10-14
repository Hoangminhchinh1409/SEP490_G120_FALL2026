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
    approveBlog,
    deleteBlog
} = require("../controllers/managerController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");

const router = express.Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền MANAGER hoặc ADMIN
router.use(requireAuth);
router.use(requireRole(["MANAGER", "ADMINISTRATOR", "ADMIN"]));

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
router.patch("/blogs/:id/approve", approveBlog);
router.delete("/blogs/:id", deleteBlog);

module.exports = router;
