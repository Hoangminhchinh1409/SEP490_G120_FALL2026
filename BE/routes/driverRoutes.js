const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const driverController = require("../controllers/driverController");

// Tất cả endpoints đều yêu cầu đăng nhập và có vai trò DRIVER (hoặc ADMINISTRATOR)
router.use(requireAuth);
router.use(requireRole(["DRIVER", 4, "ADMINISTRATOR", 1]));

// 1. Hồ sơ cá nhân & Chuyến xe
router.get("/profile", driverController.getMyProfile);
router.get("/trips/active", driverController.getActiveTrip);
router.get("/trips/history", driverController.getTripHistory);
router.get("/trips/:id", driverController.getTripDetail);

// 2. Thao tác tiến trình chuyến xe (Workflow)
router.patch("/trips/:id/accept", driverController.acceptTrip);
router.post("/trips/:id/stops/:stopId/arrive", driverController.arriveStop);
router.post("/trips/:id/stops/:stopId/event", driverController.recordStopEvent);
router.post("/trips/:id/stops/:stopId/pickup", driverController.recordPickup);
router.post("/trips/:id/stops/:stopId/delivery", driverController.recordDelivery);
router.post("/trips/:id/stops/:stopId/refuse", driverController.reportCustomerRefusal);
router.post("/trips/:id/extra-fees", driverController.proposeExtraFee);

// 3. Quản lý Ca làm việc (UC-20, BR-60)
router.get("/shifts", driverController.getMyShifts);
router.post("/shifts", driverController.registerShift);
router.delete("/shifts/:id", driverController.cancelShift);

// 4. Thông báo Tài xế (Screen 6.5, MSG80)
router.get("/notifications", driverController.getDriverNotifications);
router.patch("/notifications/read-all", driverController.markAllNotificationsRead);
router.patch("/notifications/:id/read", driverController.markNotificationRead);

// 5. Báo cáo sự cố khẩn cấp (BF-04 & UC-32)
router.post("/incidents", driverController.reportIncident);

// 6. Đồng bộ hành động ngoại tuyến (BR-27, MSG39)
router.post("/sync", driverController.syncOffline);

module.exports = router;
