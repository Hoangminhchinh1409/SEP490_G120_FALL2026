const express = require("express");

const authRoutes = require("./authRoutes");
const orderRoutes = require("./orderRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);

module.exports = router;