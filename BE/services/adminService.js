const bcrypt = require("bcrypt");
const adminModel = require("../models/adminModel");

// ==========================================
// 1. ACTIVITY LOGS
// ==========================================

const getActivityLogs = async ({
    page = 1,
    limit = 20,
    actorId = null,
    action = null,
    targetType = null,
    startDate = null,
    endDate = null,
    keyword = null
}) => {
    const validPage = Math.max(1, parseInt(page, 10) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await adminModel.getActivityLogs({
        page: validPage,
        limit: validLimit,
        actorId,
        action,
        targetType,
        startDate,
        endDate,
        keyword
    });

    const totalPages = Math.ceil(result.total / validLimit) || 1;

    return {
        logs: result.logs,
        total: result.total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1
    };
};

const logActivity = async ({
    actorId,
    actorType = "USER",
    action,
    targetType,
    targetId,
    changes = null,
    reason = null,
    ipAddress = null
}) => {
    return await adminModel.createActivityLog({
        actorId,
        actorType,
        action,
        targetType,
        targetId,
        changes,
        reason,
        ipAddress
    });
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

const getUsers = async ({
    page = 1,
    limit = 20,
    roleId = null,
    status = null,
    keyword = null
}) => {
    const validPage = Math.max(1, parseInt(page, 10) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await adminModel.getUsers({
        page: validPage,
        limit: validLimit,
        roleId,
        status,
        keyword
    });

    const totalPages = Math.ceil(result.total / validLimit) || 1;

    return {
        users: result.users,
        total: result.total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1
    };
};

const getUserById = async (id) => {
    const user = await adminModel.getUserById(id);
    if (!user) {
        throw new Error("User not found");
    }
    return user;
};

const createUser = async (userData, adminId = null, ipAddress = null) => {
    const { username, password, full_name, email, phone, zalo_link, role_id, status } = userData;

    // Validation
    if (!username || !username.trim()) {
        throw new Error("Username is required");
    }
    if (!email || !email.trim()) {
        throw new Error("Email is required");
    }
    if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
    }
    if (!full_name || !full_name.trim()) {
        throw new Error("Full name is required");
    }
    if (!role_id) {
        throw new Error("Role ID is required");
    }

    // Check unique username & email
    const existing = await adminModel.findUserByUsernameOrEmail(username.trim(), email.trim());
    if (existing) {
        if (existing.username === username.trim()) {
            throw new Error("Username already exists");
        }
        if (existing.email === email.trim()) {
            throw new Error("Email already exists");
        }
    }

    // Hash password with bcrypt (rounds >= 10)
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await adminModel.createUser({
        username: username.trim(),
        password_hash,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        zalo_link: zalo_link ? zalo_link.trim() : null,
        role_id: Number(role_id),
        status: status || "ACTIVE"
    });

    // Auto-audit log
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "CREATE_USER",
        targetType: "USER",
        targetId: newUser.id,
        changes: { username: newUser.username, email: newUser.email, role_id: newUser.role_id },
        reason: "Administrator created user account",
        ipAddress
    }).catch(err => console.error("Auto audit log failed:", err.message));

    return newUser;
};

const updateUser = async (id, updateData, adminId = null, ipAddress = null) => {
    const existingUser = await adminModel.getUserById(id);
    if (!existingUser) {
        throw new Error("User not found");
    }

    const { username, password, full_name, email, phone, zalo_link, role_id, status } = updateData;
    const fieldsToUpdate = {};

    if (username && username.trim() !== existingUser.username) {
        const dup = await adminModel.findUserByUsernameOrEmail(username.trim(), "", id);
        if (dup && dup.username === username.trim()) {
            throw new Error("Username already taken by another user");
        }
        fieldsToUpdate.username = username.trim();
    }

    if (email && email.trim().toLowerCase() !== existingUser.email) {
        const dup = await adminModel.findUserByUsernameOrEmail("", email.trim().toLowerCase(), id);
        if (dup && dup.email === email.trim().toLowerCase()) {
            throw new Error("Email already taken by another user");
        }
        fieldsToUpdate.email = email.trim().toLowerCase();
    }

    if (full_name) fieldsToUpdate.full_name = full_name.trim();
    if (phone !== undefined) fieldsToUpdate.phone = phone ? phone.trim() : null;
    if (zalo_link !== undefined) fieldsToUpdate.zalo_link = zalo_link ? zalo_link.trim() : null;
    if (role_id) fieldsToUpdate.role_id = Number(role_id);
    if (status) fieldsToUpdate.status = status;

    if (password && password.trim()) {
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long");
        }
        fieldsToUpdate.password_hash = await bcrypt.hash(password, 10);
        fieldsToUpdate.password_changed_at = new Date().toISOString();
    }

    const updated = await adminModel.updateUser(id, fieldsToUpdate);

    // Auto-audit log
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "UPDATE_USER",
        targetType: "USER",
        targetId: id,
        changes: fieldsToUpdate,
        reason: "Administrator updated user details",
        ipAddress
    }).catch(err => console.error("Auto audit log failed:", err.message));

    return updated;
};

const updateUserStatus = async (id, status, adminId = null, ipAddress = null) => {
    const validStatuses = ["ACTIVE", "LOCKED", "INACTIVE"];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`);
    }

    const user = await adminModel.getUserById(id);
    if (!user) {
        throw new Error("User not found");
    }

    // Safety guard: Admin cannot lock their own account
    if (adminId && Number(adminId) === Number(id) && status !== "ACTIVE") {
        throw new Error("You cannot lock or deactivate your own administrator account");
    }

    const updated = await adminModel.updateUserStatus(id, status);

    // Auto-audit log
    const action = status === "LOCKED" ? "LOCK_USER" : status === "ACTIVE" ? "ACTIVATE_USER" : "DEACTIVATE_USER";
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action,
        targetType: "USER",
        targetId: id,
        changes: { previousStatus: user.status, newStatus: status },
        reason: `Administrator changed user status to ${status}`,
        ipAddress
    }).catch(err => console.error("Auto audit log failed:", err.message));

    return updated;
};

// ==========================================
// 3. ROLES
// ==========================================

const getRoles = async () => {
    return await adminModel.getRoles();
};

// ==========================================
// 4. DASHBOARD STATS
// ==========================================

const getDashboardStats = async () => {
    return await adminModel.getDashboardStats();
};

// ==========================================
// 5. SYSTEM SETTINGS
// ==========================================

const getSystemSettings = async () => {
    return await adminModel.getSystemSettings();
};

const updateSystemSetting = async (key, value, adminId = null, ipAddress = null) => {
    if (!key || !key.trim()) {
        throw new Error("Setting key is required");
    }

    const updated = await adminModel.upsertSystemSetting(key.trim(), value, adminId);

    // Auto-audit log
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "UPDATE_SETTING",
        targetType: "SYSTEM",
        targetId: key.trim(),
        changes: { key: key.trim(), value },
        reason: "Administrator updated system configuration",
        ipAddress
    }).catch(err => console.error("Auto audit log failed:", err.message));

    return updated;
};

// ==========================================
// 6. PERMISSIONS MATRIX (UC-34)
// ==========================================

const getPermissionsMatrix = async () => {
    return await adminModel.getPermissionsMatrix();
};

const updateRolePermissions = async (roleId, permissionIds, adminId = null, ipAddress = null) => {
    if (!roleId) {
        throw new Error("Role ID is required");
    }

    const result = await adminModel.updateRolePermissions(roleId, permissionIds);

    // Auto-audit log (UC-35)
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "UPDATE_ROLE_PERMISSIONS",
        targetType: "ROLE",
        targetId: roleId,
        changes: { roleId, permissionIds },
        reason: `Administrator updated permissions for role ID ${roleId}`,
        ipAddress
    }).catch(err => console.error("Auto audit log failed:", err.message));

    return result;
};

module.exports = {
    getActivityLogs,
    logActivity,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    updateUserStatus,
    getRoles,
    getDashboardStats,
    getSystemSettings,
    updateSystemSetting,
    getPermissionsMatrix,
    updateRolePermissions
};
