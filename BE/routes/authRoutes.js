const express = require("express");
const { rateLimit } = require("express-rate-limit");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();
const createRateLimiter = (windowMs, limit, message, keyGenerator) => rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) => res.status(429).json({ message })
});

const forgotPasswordRateLimit = createRateLimiter(
    60 * 60 * 1000,
    5,
    "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau."
);
const resetPasswordRateLimit = createRateLimiter(
    15 * 60 * 1000,
    10,
    "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau."
);
const changePasswordIpRateLimit = createRateLimiter(
    15 * 60 * 1000,
    20,
    "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau."
);
const changePasswordUserRateLimit = createRateLimiter(
    15 * 60 * 1000,
    5,
    "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
    (req) => `user:${req.user.id}`
);

router.post("/login", authController.login);

router.post("/forgot-password", forgotPasswordRateLimit, authController.forgotPassword);

router.post("/reset-password", resetPasswordRateLimit, authController.resetPassword);

router.get("/me", requireAuth, authController.getMe);

router.patch("/me", requireAuth, authController.updateProfile);

router.patch(
    "/change-password",
    requireAuth,
    changePasswordIpRateLimit,
    changePasswordUserRateLimit,
    authController.changePassword
);

router.post("/logout", authController.logout);

module.exports = router;