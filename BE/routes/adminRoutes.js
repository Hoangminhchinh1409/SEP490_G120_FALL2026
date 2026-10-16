const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const adminController = require("../controllers/adminController");

// Require authentication and Administrator role for all Admin endpoints
router.use(requireAuth);
router.use(requireRole(["ADMINISTRATOR", "ADMIN", 1]));

// 1. Dashboard Stats
router.get("/dashboard/stats", adminController.getDashboardStats);

// 2. Activity Logs
router.get("/logs", adminController.getActivityLogs);

// 3. User Management
router.get("/users", adminController.getUsers);
router.post("/users", adminController.createUser);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id", adminController.updateUser);
router.patch("/users/:id/status", adminController.updateUserStatus);

// 4. Roles
router.get("/roles", adminController.getRoles);

// 5. System Settings
router.get("/settings", adminController.getSystemSettings);
router.put("/settings", adminController.updateSystemSetting);

module.exports = router;
