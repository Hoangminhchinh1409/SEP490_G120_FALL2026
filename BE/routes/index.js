const express = require("express");

const authRoutes = require("./authRoutes");
const orderRoutes = require("./orderRoutes");
const blogRoutes = require("./blogRoutes");
const dispatcherRoutes = require("./dispatcherRoutes");
const adminRoutes = require("./adminRoutes");
const driverRoutes = require("./driverRoutes");
const managerRoutes = require("./managerRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/blogs", blogRoutes);
router.use("/dispatcher", dispatcherRoutes);
router.use("/admin", adminRoutes);
router.use("/driver", driverRoutes);
router.use("/manager", managerRoutes);
router.use(dispatcherRoutes);

module.exports = router;
