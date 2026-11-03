const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userModel = require("../models/userModel");
const driverModel = require("../models/driverModel");
const supabase = require("../config/supabase");
const { sendPasswordResetEmail } = require("./emailService");

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 30;
const ROLE_NAMES = {
    1: "ADMINISTRATOR",
    2: "MANAGER",
    3: "DISPATCHER",
    4: "DRIVER"
};

const getPasswordResetTtlMinutes = async () => {
    const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "password_reset_link_lifetime")
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return DEFAULT_PASSWORD_RESET_TTL_MINUTES;
    }

    const ttlMinutes = Number(data.value);
    if (!Number.isSafeInteger(ttlMinutes) || ttlMinutes <= 0) {
        throw new Error("Invalid password reset link lifetime setting");
    }

    return ttlMinutes;
};

const login = async (identifier, password) => {
    if (
        typeof identifier !== "string" ||
        typeof password !== "string" ||
        !identifier.trim() ||
        identifier.trim().length > 100 ||
        !password
    ) {
        const error = new TypeError("Username/email and password are required");
        error.statusCode = 400;
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    const trimmedIdentifier = identifier.trim();
    const normalizedIdentifier = trimmedIdentifier.includes("@")
        ? trimmedIdentifier.toLowerCase()
        : trimmedIdentifier;
    const user = await userModel.findUserByIdentifier(normalizedIdentifier);
    if (!user) {
        const error = new Error("Wrong username or password");
        error.code = "MSG05";
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!isPasswordValid) {
        const error = new Error("Wrong username or password");
        error.code = "MSG05";
        throw error;
    }

    if (user.status !== "ACTIVE") {
        const error = new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản lý hoặc Quản trị viên.");
        error.code = "MSG06";
        throw error;
    }

    // Kiểm tra Chế độ bảo trì hệ thống (SRS v2 - MSG86)
    if (Number(user.role_id) !== 1) {
        const { data: maintenanceSetting, error: maintenanceError } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "maintenance_mode")
            .maybeSingle();

        if (maintenanceError) {
            throw maintenanceError;
        }

        if (maintenanceSetting && (maintenanceSetting.value === "true" || maintenanceSetting.value === true)) {
            const error = new Error("Hệ thống đang bảo trì. Vui lòng quay lại sau.");
            error.code = "MSG86";
            throw error;
        }
    }

    const updatedUser = await userModel.updateLastLogin(user.id);

    const token = jwt.sign(
        {
            id: updatedUser.id,
            username: updatedUser.username,
            role_id: updatedUser.role_id,
            pwdv: updatedUser.password_changed_at
                ? new Date(updatedUser.password_changed_at).getTime()
                : 0
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );

    return {
        token,
        user: await getCurrentUser(updatedUser.id)
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

const normalizePhone = (phone) => {
    return phone.trim().replace(/[.\s()-]/g, "");
};

const updateProfile = async (userId, payload = {}) => {
    const fullName = typeof payload.full_name === "string"
        ? payload.full_name.trim()
        : "";
    if (typeof payload.phone !== "string" && payload.phone != null) {
        const error = new Error("Số điện thoại không hợp lệ");
        error.statusCode = 400;
        throw error;
    }
    const phone = typeof payload.phone === "string"
        ? normalizePhone(payload.phone)
        : "";
    const zaloLink = typeof payload.zalo_link === "string"
        ? payload.zalo_link.trim()
        : "";

    if (!fullName || fullName.length > 100 || /[<>]/.test(fullName)) {
        const error = new Error("Họ và tên không hợp lệ hoặc vượt quá 100 ký tự");
        error.statusCode = 400;
        throw error;
    }

    if (payload.zalo_link != null && typeof payload.zalo_link !== "string") {
        const error = new Error("Liên kết Zalo không hợp lệ");
        error.statusCode = 400;
        throw error;
    }

    if (zaloLink) {
        let parsedLink;
        try {
            parsedLink = new URL(zaloLink);
        } catch {
            const error = new Error("Liên kết Zalo không hợp lệ");
            error.statusCode = 400;
            throw error;
        }

        if (
            zaloLink.length > 255 ||
            parsedLink.protocol !== "https:" ||
            parsedLink.hostname !== "zalo.me" ||
            parsedLink.username ||
            parsedLink.password
        ) {
            const error = new Error("Liên kết Zalo không hợp lệ");
            error.statusCode = 400;
            throw error;
        }
    }

    if (phone && !/^\+?\d{9,15}$/.test(phone)) {
        const error = new Error("Số điện thoại không hợp lệ");
        error.statusCode = 400;
        throw error;
    }

    const updated = await userModel.updateProfile(userId, {
        full_name: fullName,
        phone: phone || null,
        zalo_link: zaloLink || null
    });

    try {
        return await getCurrentUser(userId);
    } catch (error) {
        console.error("getCurrentUser after updateProfile failed:", {
            name: error.name,
            code: error.code || null
        });
        return {
            id: updated.id,
            username: updated.username,
            full_name: updated.full_name,
            email: updated.email,
            phone: updated.phone,
            zalo_link: updated.zalo_link || null,
            role_id: updated.role_id,
            role_name: ROLE_NAMES[Number(updated.role_id)] || null,
            created_at: updated.created_at,
            updated_at: updated.updated_at,
            last_login_at: updated.last_login_at,
            driver_profile: null
        };
    }
};

const changePassword = async (userId, currentPassword, newPassword) => {
    if (typeof currentPassword !== "string" || !currentPassword) {
        const error = new Error("Vui lòng nhập mật khẩu hiện tại.");
        error.statusCode = 400;
        throw error;
    }

    if (typeof newPassword !== "string" || !newPassword) {
        const error = new Error("Vui lòng nhập mật khẩu mới.");
        error.statusCode = 400;
        throw error;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.statusCode = 400;
        error.code = "MSG59";
        throw error;
    }

    if (Buffer.byteLength(newPassword, "utf8") > PASSWORD_MAX_BYTES) {
        const error = new Error("Mật khẩu mới không được vượt quá 72 byte.");
        error.statusCode = 400;
        error.code = "MSG59";
        throw error;
    }

    if (newPassword === currentPassword) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.statusCode = 400;
        error.code = "MSG59";
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
        const error = new Error("Mật khẩu hiện tại không đúng.");
        error.statusCode = 400;
        error.code = "MSG58";
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await userModel.updatePassword(userId, passwordHash);
    const token = jwt.sign(
        {
            id: user.id,
            username: user.username,
            role_id: user.role_id,
            pwdv: updatedUser.password_changed_at
                ? new Date(updatedUser.password_changed_at).getTime()
                : 0
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    return {
        message: "Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.",
        code: "MSG60",
        token
    };
};


const requestPasswordReset = async (email, requestId) => {
    const normalizedEmail = email.trim().toLowerCase();
    const genericResponse = {
        message: "Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi.",
        code: "MSG70"
    };
    const user = await userModel.findUserByEmail(normalizedEmail);

    if (!user || String(user.status).toUpperCase() !== "ACTIVE") {
        return genericResponse;
    }

    setImmediate(async () => {
        try {
            const ttlMinutes = await getPasswordResetTtlMinutes();
            const rawToken = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");
            const expiresAt = new Date(
                Date.now() + ttlMinutes * 60 * 1000
            ).toISOString();

            await userModel.createPasswordResetToken(
                user.id,
                tokenHash,
                expiresAt
            );

            const resetPageUrl =
                process.env.PASSWORD_RESET_URL ||
                `${(process.env.FRONTEND_URL || "http://localhost:3000")
                    .replace(/\/+$/, "")}/reset-password`;

            const resetUrl = new URL(resetPageUrl);
            resetUrl.searchParams.set("token", rawToken);

            await sendPasswordResetEmail({
                email: user.email,
                customerName: user.full_name,
                resetUrl: resetUrl.toString(),
                ttlMinutes
            });
        } catch (error) {
            console.error(`[forgotPassword:${requestId}] Reset email dispatch failed`, {
                name: error.name,
                code: error.code || null
            });
        }
    });

    return genericResponse;
};


const resetPassword = async (token, newPassword) => {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token.trim())) {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.statusCode = 400;
        error.code = "MSG61";
        throw error;
    }

    if (typeof newPassword !== "string" || !newPassword) {
        const error = new Error("Mật khẩu mới không hợp lệ.");
        error.statusCode = 400;
        throw error;
    }

    if (
        newPassword.length < PASSWORD_MIN_LENGTH ||
        Buffer.byteLength(newPassword, "utf8") > PASSWORD_MAX_BYTES
    ) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và không vượt quá 72 byte.");
        error.statusCode = 400;
        error.code = "MSG59";
        throw error;
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");
    const resetToken = await userModel.consumePasswordResetToken(tokenHash);

    if (!resetToken) {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.statusCode = 400;
        error.code = "MSG61";
        throw error;
    }

    const user = await userModel.findUserById(resetToken.user_id);
    if (!user || String(user.status).toUpperCase() !== "ACTIVE") {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.statusCode = 400;
        error.code = "MSG61";
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(resetToken.user_id, passwordHash);

    return {
        message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
        code: "MSG60"
    };
};

module.exports = {
    login,
    getCurrentUser,
    updateProfile,
    changePassword,
    requestPasswordReset,
    resetPassword
};
