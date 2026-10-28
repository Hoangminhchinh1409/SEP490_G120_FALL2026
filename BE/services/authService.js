const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userModel = require("../models/userModel");
const driverModel = require("../models/driverModel");
const supabase = require("../config/supabase");

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

    // Kiểm tra Chế độ bảo trì hệ thống (SRS v2 / Report 4 - MSG86)
    // Khi bật bảo trì, chỉ duy nhất Administrator (role_id = 1) được phép đăng nhập
    if (Number(user.role_id) !== 1) {
        const { data: maintenanceSetting } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "maintenance_mode")
            .maybeSingle();

        if (maintenanceSetting && (maintenanceSetting.value === "true" || maintenanceSetting.value === true)) {
            const error = new Error("Hệ thống đang bảo trì. Vui lòng quay lại sau.");
            error.code = "MSG86";
            error.statusCode = 403;
            throw error;
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
        const error = new Error("Mật khẩu hiện tại không đúng.");
        error.code = "MSG58";
        error.statusCode = 400;
        throw error;
    }

    if (typeof newPassword !== "string" || !newPassword || newPassword.length < 8) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.code = "MSG59";
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
        const error = new Error("Mật khẩu hiện tại không đúng.");
        error.code = "MSG58";
        error.statusCode = 400;
        throw error;
    }

    if (currentPassword === newPassword) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.code = "MSG59";
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(userId, passwordHash);

    return {
        message: "Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.",
        code: "MSG60"
    };
};

const requestPasswordReset = async (email) => {
    if (!email || typeof email !== "string") {
        return {
            message: "Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi.",
            code: "MSG70"
        };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data: user } = await supabase
        .from("users")
        .select("id, email, username, status")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (user && user.status === "ACTIVE") {
        // Lấy thời hạn link reset từ system_settings (BR-49, mặc định 30 phút)
        let expiryMinutes = 30;
        const { data: expirySetting } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "password_reset_expiry_minutes")
            .maybeSingle();

        if (expirySetting && !isNaN(Number(expirySetting.value))) {
            expiryMinutes = Number(expirySetting.value);
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiryDate = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

        await supabase
            .from("users")
            .update({
                password_reset_token: token,
                password_reset_expiry: expiryDate,
                updated_at: new Date().toISOString()
            })
            .eq("id", user.id);

        console.log(`[PASSWORD_RESET] Generated reset token for ${user.email}: ${token} (expires in ${expiryMinutes}m at ${expiryDate})`);
    }

    return {
        message: "Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi.",
        code: "MSG70"
    };
};

const resetPasswordWithToken = async (token, newPassword) => {
    if (!token || typeof token !== "string") {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.code = "MSG61";
        error.statusCode = 400;
        throw error;
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.code = "MSG59";
        error.statusCode = 400;
        throw error;
    }

    const { data: user, error: findError } = await supabase
        .from("users")
        .select("id, password_hash, password_reset_expiry")
        .eq("password_reset_token", token)
        .maybeSingle();

    if (findError || !user) {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.code = "MSG61";
        error.statusCode = 400;
        throw error;
    }

    const isExpired = !user.password_reset_expiry || new Date(user.password_reset_expiry).getTime() < Date.now();
    if (isExpired) {
        const error = new Error("Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.");
        error.code = "MSG61";
        error.statusCode = 400;
        throw error;
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
        const error = new Error("Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.");
        error.code = "MSG59";
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await supabase
        .from("users")
        .update({
            password_hash: passwordHash,
            password_reset_token: null,
            password_reset_expiry: null,
            password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

    return {
        message: "Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.",
        code: "MSG60"
    };
};

module.exports = {
    login,
    getCurrentUser,
    changePassword,
    requestPasswordReset,
    resetPasswordWithToken
};