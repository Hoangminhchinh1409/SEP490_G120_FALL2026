const authService = require("../services/authService");
const crypto = require("crypto");

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                message: "Username/email and password are required"
            });
        }

        const result = await authService.login(
            identifier,
            password
        );

        res.cookie("token", result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "Login successful",
            user: result.user
        });

    } catch (error) {
        return res.status(401).json({
            message: error.message,
            code: error.code || null
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await authService.getCurrentUser(req.user.id);

        return res.status(200).json({
            user
        });

    } catch (error) {
        const statusCode = error.message === "User not found" ? 404 : 500;
        return res.status(statusCode).json({
            message: error.message
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await authService.updateProfile(req.user.id, req.body || {});

        return res.status(200).json({
            message: "Cập nhật hồ sơ thành công",
            user
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error("updateProfile Error:", error);
        }
        return res.status(error.statusCode || 500).json({
            message: error.message || "Internal server error"
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        const result = await authService.changePassword(
            req.user.id,
            currentPassword,
            newPassword
        );

        return res.status(200).json(result);
    } catch (error) {
        if (!error.statusCode) {
            console.error("changePassword Error:", error);
        }
        return res.status(error.statusCode || 500).json({
            message: error.statusCode ? error.message : "Internal server error",
            code: error.code || null
        });
    }
};

const forgotPassword = async (req, res) => {
    const requestId = crypto.randomUUID();
    res.set("X-Request-Id", requestId);

    console.info(`[forgotPassword:${requestId}] Request received`);

    try {
        const { email } = req.body || {};

        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        console.info(`[forgotPassword:${requestId}] Calling service`);

        const result = await authService.requestPasswordReset(
            email.trim(),
            requestId
        );

        console.info(
            `[forgotPassword:${requestId}] Request completed`,
            {
                hasResetToken: Boolean(result.resetToken)
            }
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error(`[forgotPassword:${requestId}] Request failed`, {
            name: error.name,
            code: error.code || null,
            message: error.message
        });

        return res.status(500).json({
            message: "Unable to process password reset request",
            requestId
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body || {};
        const result = await authService.resetPassword(token, newPassword);

        return res.status(200).json(result);
    } catch (error) {
        if (!error.statusCode) {
            console.error("resetPassword Error:", error);
        }
        return res.status(error.statusCode || 500).json({
            message: error.statusCode ? error.message : "Unable to reset password",
            code: error.code || null
        });
    }
};

const logout = async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production"
            ? "none"
            : "lax"
    });

    return res.status(200).json({
        message: "Logout successful"
    });
};

module.exports = {
    login,
    getMe,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    logout
};