const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

    if (newPassword.length < 6) {
        const error = new Error("Password must be at least 6 characters long");
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


module.exports = {
    login,
    getCurrentUser,
    changePassword
};