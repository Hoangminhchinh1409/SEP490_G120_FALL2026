const express = require("express");

const authRoutes = require("./authRoutes");
const orderRoutes = require("./orderRoutes");
const blogRoutes = require("./blogRoutes");
const dispatcherRoutes = require("./dispatcherRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/blogs", blogRoutes);
router.use("/dispatcher", dispatcherRoutes);
router.use(dispatcherRoutes);

module.exports = router;
