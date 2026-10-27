const express = require("express");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);

router.post("/forgot-password", authController.forgotPassword);

router.post("/reset-password", authController.resetPassword);

router.get("/me", requireAuth, authController.getMe);

router.patch("/change-password", requireAuth, authController.changePassword);

router.post("/logout", authController.logout);

module.exports = router;