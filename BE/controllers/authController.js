const authService = require("../services/authService");
const adminModel = require("../models/adminModel");
const { getClientIp } = require("../utils/ipHelper");
const crypto = require("crypto");

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body || {};
        const trimmedIdentifier = typeof identifier === "string"
            ? identifier.trim()
            : "";

        if (
            typeof identifier !== "string" ||
            !trimmedIdentifier ||
            trimmedIdentifier.length > 100 ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                message: "Username/email and password are required"
            });
        }

        const result = await authService.login(
            trimmedIdentifier.includes("@")
                ? trimmedIdentifier.toLowerCase()
                : trimmedIdentifier,
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

        // BUG-ADM-12: Record login activity in activity_logs
        try {
            const clientIp = getClientIp(req);
            await adminModel.createActivityLog({
                actorId: result.user.id,
                actorType: result.user.role_name || (result.user.role_id === 1 ? 'ADMINISTRATOR' : result.user.role_id === 2 ? 'MANAGER' : result.user.role_id === 3 ? 'DISPATCHER' : 'DRIVER'),
                action: 'LOGIN',
                targetType: 'AUTH',
                targetId: result.user.id,
                changes: { username: result.user.username, role_id: result.user.role_id },
                reason: 'Đăng nhập hệ thống thành công',
                ipAddress: clientIp
            });
        } catch (logErr) {
            console.warn('[AuthController] Login activity log warning:', logErr.message);
        }

        return res.status(200).json({
            message: "Login successful",
            user: result.user
        });

    } catch (error) {
        if (error.code === "MSG05") {
            return res.status(401).json({
                message: "Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại.",
                code: "MSG05"
            });
        }

        if (error.code === "MSG06") {
            return res.status(401).json({
                message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản lý hoặc Quản trị viên.",
                code: "MSG06"
            });
        }

        if (error.code === "MSG86") {
            return res.status(503).json({
                message: "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
                code: "MSG86"
            });
        }

        if (
            error.statusCode === 400 ||
            error.code === "INVALID_IDENTIFIER" ||
            error.code === "INVALID_CREDENTIALS"
        ) {
            return res.status(400).json({
                message: "Invalid username/email or password"
            });
        }

        console.error("Login failed:", {
            name: error.name,
            code: error.code || null
        });
        return res.status(500).json({
            message: "Internal server error"
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
        if (error.statusCode === 400 || error.statusCode === 404) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }
        console.error("updateProfile failed:", {
            name: error.name,
            code: error.code || null
        });
        return res.status(500).json({
            message: "Internal server error"
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
        res.cookie("token", result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: result.message,
            code: result.code
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
                code: error.code || null
            });
        }
        console.error("changePassword failed:", {
            name: error.name,
            code: error.code || null
        });
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const forgotPassword = async (req, res) => {
    const requestId = crypto.randomUUID();
    res.set("X-Request-Id", requestId);

    try {
        const { email } = req.body || {};
        const normalizedEmail = typeof email === "string" ? email.trim() : "";

        if (
            typeof email !== "string" ||
            normalizedEmail.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).json({
                message: "Email không hợp lệ."
            });
        }

        const result = await authService.requestPasswordReset(normalizedEmail, requestId);
        return res.status(200).json(result);
    } catch (error) {
        console.error(`[forgotPassword:${requestId}] Request failed`, {
            name: error.name,
            code: error.code || null
        });

        return res.status(200).json({
            message: "Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi.",
            code: "MSG70"
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body || {};
        const result = await authService.resetPassword(token, newPassword);

        return res.status(200).json(result);
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
                code: error.code || null
            });
        }
        console.error("resetPassword failed:", {
            name: error.name,
            code: error.code || null
        });
        return res.status(500).json({
            message: "Không thể đặt lại mật khẩu lúc này."
        });
    }
};

const logout = async (req, res) => {
    // BUG-ADM-12: Record logout activity in activity_logs
    try {
        if (req.user?.id) {
            const clientIp = getClientIp(req);
            await adminModel.createActivityLog({
                actorId: req.user.id,
                actorType: req.user.role_name || 'USER',
                action: 'LOGOUT',
                targetType: 'AUTH',
                targetId: req.user.id,
                changes: null,
                reason: 'Đăng xuất khỏi hệ thống',
                ipAddress: clientIp
            });
        }
    } catch (logErr) {
        console.warn('[AuthController] Logout activity log warning:', logErr.message);
    }
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
