const express = require("express");

const authRoutes = require("./authRoutes");
const orderRoutes = require("./orderRoutes");
const blogRoutes = require("./blogRoutes");
const dispatcherRoutes = require("./dispatcherRoutes");
const adminRoutes = require("./adminRoutes");
const driverRoutes = require("./driverRoutes");
const managerRoutes = require("./managerRoutes");
const aiRoutes = require("./aiRoutes");
const uploadRoutes = require("./uploadRoutes");
const tripController = require("../controllers/tripController");
const routingRoutes = require("./routingRoutes");

const router = express.Router();

// Public trip details / e-waybill endpoint (không yêu cầu đăng nhập)
router.get("/trips/public/:code", tripController.getPublicTrip);

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/blogs", blogRoutes);
router.use("/dispatcher", dispatcherRoutes);
router.use("/admin", adminRoutes);
router.use("/driver", driverRoutes);
router.use("/manager", managerRoutes);
router.use("/ai", aiRoutes);
router.use("/uploads", uploadRoutes);
router.use("/routing", routingRoutes);

module.exports = router;
