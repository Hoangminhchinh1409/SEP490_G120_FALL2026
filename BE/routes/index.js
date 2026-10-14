const express = require("express");

const authRoutes = require("./authRoutes");
const orderRoutes = require("./orderRoutes");
const blogRoutes = require("./blogRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/blogs", blogRoutes);

module.exports = router;