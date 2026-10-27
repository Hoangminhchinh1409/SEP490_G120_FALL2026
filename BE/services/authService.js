const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userModel = require("../models/userModel");
const driverModel = require("../models/driverModel");
const supabase = require("../config/supabase");
const { sendPasswordResetEmail } = require("./emailService");

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const ROLE_NAMES = {
    1: "ADMINISTRATOR",
    2: "MANAGER",
    3: "DISPATCHER",
    4: "DRIVER"
};

const login = async (identifier, password) => {
    const user = await userModel.findUserByIdentifier(identifier);
    if (!user) {
        throw new Error("Invalid username/email or password");
    }

    if (user.status !== "ACTIVE") {
        const error = new Error("[MSG06] Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
        error.code = "MSG06";
        throw error;
    }

    // Kiểm tra Chế độ bảo trì hệ thống (SRS v2 - MSG86)
    // Khi bật bảo trì, chỉ duy nhất Administrator (role_id = 1) được phép đăng nhập
    if (Number(user.role_id) !== 1) {
        const { data: maintenanceSetting } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "maintenance_mode")
            .maybeSingle();

        if (maintenanceSetting && (maintenanceSetting.value === "true" || maintenanceSetting.value === true)) {
            throw new Error("Hệ thống đang bảo trì. Vui lòng quay lại sau.");
        }
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!isPasswordValid) {
        throw new Error("Invalid username/email or password");
    }

    const updatedUser = await userModel.updateLastLogin(user.id);

    const token = jwt.sign(
        {
            id: updatedUser.id,
            username: updatedUser.username,
            role_id: updatedUser.role_id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );

    return {
        token,
        user: {
            id: updatedUser.id,
            username: updatedUser.username,
            full_name: updatedUser.full_name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            zalo_link: updatedUser.zalo_link,
            role_id: updatedUser.role_id,
            status: updatedUser.status
        }
    };
};


const getCurrentUser = async (userId) => {
    const user = await userModel.findUserById(userId);

    if (!user) {
        throw new Error("User not found");
    }

    const driverProfile = Number(user.role_id) === 4
        ? await driverModel.getDriverProfileByUserId(user.id)
        : null;

    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        zalo_link: user.zalo_link,
        role_id: user.role_id,
        role_name: ROLE_NAMES[Number(user.role_id)] || null,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
        driver_profile: driverProfile
            ? {
                id: driverProfile.id,
                user_account_id: driverProfile.user_account_id,
                license_number: driverProfile.license_number,
                license_class: driverProfile.license_class,
                license_expiry: driverProfile.license_expiry,
                status: driverProfile.status,
                last_trip_ended_at: driverProfile.last_trip_ended_at
            }
            : null
    };
};

const changePassword = async (userId, currentPassword, newPassword) => {
    if (typeof currentPassword !== "string" || !currentPassword) {
        const error = new Error("Current password is required");
        error.statusCode = 400;
        throw error;
    }

    if (typeof newPassword !== "string" || !newPassword) {
        const error = new Error("New password is required");
        error.statusCode = 400;
        throw error;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
        const error = new Error("Password must be at least 6 characters long");
        error.statusCode = 400;
        throw error;
    }

    if (newPassword === currentPassword) {
        const error = new Error("New password must be different from current password");
        error.statusCode = 400;
        throw error;
    }

    const user = await userModel.findUserById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password_hash
    );

    if (!isCurrentPasswordValid) {
        const error = new Error("Current password is incorrect");
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(userId, passwordHash);

    return { message: "Password changed successfully" };
};


const requestPasswordReset = async (email, requestId) => {
    try {
        const normalizedEmail = email.trim().toLowerCase();

        console.log("NODE_ENV =", process.env.NODE_ENV);
        console.log(`[forgotPassword:${requestId}] Looking up account`);

        const user = await userModel.findUserByEmail(normalizedEmail);

        console.log("Password reset user found:", Boolean(user));

        if (!user) {
            console.log(`[forgotPassword:${requestId}] No account found`);

            return {
                message:
                    "If an account exists for this email, password reset instructions will be sent."
            };
        }

        // Sinh token mới
        const rawToken = crypto.randomBytes(32).toString("hex");

        // Chỉ lưu hash của token vào database
        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        const expiresAt = new Date(
            Date.now() + PASSWORD_RESET_TOKEN_TTL_MS
        ).toISOString();

        console.log(`[forgotPassword:${requestId}] Saving reset token`);

        await userModel.createPasswordResetToken(
            user.id,
            tokenHash,
            expiresAt
        );

        const response = {
            message:
                "If an account exists for this email, password reset instructions will be sent."
        };

        // Chỉ trả token trực tiếp khi test local
        if (process.env.NODE_ENV === "development") {
            response.resetToken = rawToken;
            console.log("Reset token generated for development");

            return response;
        }

        // Môi trường production: gửi token qua email
        const resetPageUrl =
            process.env.PASSWORD_RESET_URL ||
            `${(process.env.FRONTEND_URL || "http://localhost:3000")
                .replace(/\/+$/, "")}/reset-password`;

        const resetUrl = new URL(resetPageUrl);
        resetUrl.searchParams.set("token", rawToken);

        console.log(`[forgotPassword:${requestId}] Sending reset email`);

        await sendPasswordResetEmail({
            email: normalizedEmail,
            resetUrl: resetUrl.toString()
        });

        console.log(`[forgotPassword:${requestId}] Reset email sent`);

        return response;
    } catch (error) {
        console.error(`[forgotPassword:${requestId}] Request failed`, {
            name: error.name,
            code: error.code,
            message: error.message
        });

        throw error;
    }
};


const resetPassword = async (token, newPassword) => {
    if (typeof token !== "string" || !token.trim()) {
        const error = new Error("Password reset token is required");
        error.statusCode = 400;
        throw error;
    }

    if (typeof newPassword !== "string" || !newPassword) {
        const error = new Error("New password is required");
        error.statusCode = 400;
        throw error;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
        const error = new Error("Password must be at least 6 characters long");
        error.statusCode = 400;
        throw error;
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");
    const resetToken = await userModel.consumePasswordResetToken(tokenHash);

    if (!resetToken) {
        const error = new Error("Password reset token is invalid or expired");
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(resetToken.user_id, passwordHash);

    return { message: "Password reset successfully" };
};

module.exports = {
    login,
    getCurrentUser,
    changePassword,
    requestPasswordReset,
    resetPassword
};