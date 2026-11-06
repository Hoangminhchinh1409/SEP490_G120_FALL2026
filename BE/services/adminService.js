const bcrypt = require("bcrypt");
const adminModel = require("../models/adminModel");

// Validation constants
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = [1, 2, 3, 4];
const VALID_STATUSES = ["ACTIVE", "LOCKED", "INACTIVE"];

const validateUsername = (username) => {
    if (!username || typeof username !== "string" || !username.trim()) {
        const err = new Error("Username is required");
        err.statusCode = 400;
        throw err;
    }
    const trimmed = username.trim();
    if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
        const err = new Error(`Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters`);
        err.statusCode = 400;
        throw err;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
        const err = new Error("Username can only contain alphanumeric characters, dots, underscores, and hyphens");
        err.statusCode = 400;
        throw err;
    }
    return trimmed;
};

const validateEmail = (email) => {
    if (!email || typeof email !== "string" || !email.trim()) {
        const err = new Error("Email is required");
        err.statusCode = 400;
        throw err;
    }
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length > 255 || !EMAIL_REGEX.test(trimmed)) {
        const err = new Error("Invalid email format");
        err.statusCode = 400;
        throw err;
    }
    return trimmed;
};

const validatePassword = (password) => {
    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        const err = new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
        err.statusCode = 400;
        throw err;
    }
    if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        const err = new Error(`Password must not exceed ${PASSWORD_MAX_BYTES} UTF-8 bytes`);
        err.statusCode = 400;
        throw err;
    }
};

const validateRole = (roleId) => {
    const numRoleId = Number(roleId);
    if (!Number.isInteger(numRoleId) || !VALID_ROLES.includes(numRoleId)) {
        const err = new Error(`Invalid role_id: ${roleId}. Must be one of ${VALID_ROLES.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }
    return numRoleId;
};

const validateStatus = (status) => {
    if (!VALID_STATUSES.includes(status)) {
        const err = new Error(`Invalid status: ${status}. Must be one of ${VALID_STATUSES.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }
    return status;
};

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
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    return user;
};

const createUser = async (userData, adminId = null, ipAddress = null) => {
    const { username, password, full_name, email, phone, zalo_link, role_id, status } = userData;

    // Validation
    const cleanUsername = validateUsername(username);
    const cleanEmail = validateEmail(email);
    validatePassword(password);

    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
        const err = new Error("Full name is required");
        err.statusCode = 400;
        throw err;
    }

    const numRoleId = validateRole(role_id);
    const cleanStatus = status ? validateStatus(status) : "ACTIVE";

    // Check unique username & email (case-insensitive)
    const existing = await adminModel.findUserByUsernameOrEmail(cleanUsername, cleanEmail);
    if (existing) {
        if (existing.username && existing.username.toLowerCase() === cleanUsername.toLowerCase()) {
            const err = new Error("Username already exists");
            err.statusCode = 409;
            throw err;
        }
        if (existing.email && existing.email.toLowerCase() === cleanEmail) {
            const err = new Error("Email already exists");
            err.statusCode = 409;
            throw err;
        }
        const err = new Error("Username or Email already exists");
        err.statusCode = 409;
        throw err;
    }

    // Hash password with bcrypt (rounds >= 10)
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await adminModel.createUser({
        username: cleanUsername,
        password_hash,
        full_name: full_name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        zalo_link: zalo_link ? zalo_link.trim() : null,
        role_id: numRoleId,
        status: cleanStatus
    });

    // Auto-audit log
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "CREATE_USER",
        targetType: "USER",
        targetId: newUser.id,
        changes: { username: newUser.username, email: newUser.email, role_id: newUser.role_id, status: newUser.status },
        reason: "Administrator created user account",
        ipAddress
    });

    return newUser;
};

const updateUser = async (id, updateData, adminId = null, ipAddress = null) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const existingUser = await adminModel.getUserById(numId);
    if (!existingUser) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const { username, password, full_name, email, phone, zalo_link, role_id, status } = updateData;
    const fieldsToUpdate = {};

    if (username !== undefined && username !== null) {
        const cleanUsername = validateUsername(username);
        if (cleanUsername.toLowerCase() !== existingUser.username?.toLowerCase()) {
            const dup = await adminModel.findUserByUsernameOrEmail(cleanUsername, "", numId);
            if (dup && dup.username && dup.username.toLowerCase() === cleanUsername.toLowerCase()) {
                const err = new Error("Username already taken by another user");
                err.statusCode = 409;
                throw err;
            }
            fieldsToUpdate.username = cleanUsername;
        }
    }

    if (email !== undefined && email !== null) {
        const cleanEmail = validateEmail(email);
        if (cleanEmail !== existingUser.email?.toLowerCase()) {
            const dup = await adminModel.findUserByUsernameOrEmail("", cleanEmail, numId);
            if (dup && dup.email && dup.email.toLowerCase() === cleanEmail) {
                const err = new Error("Email already taken by another user");
                err.statusCode = 409;
                throw err;
            }
            fieldsToUpdate.email = cleanEmail;
        }
    }

    if (full_name !== undefined) {
        if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
            const err = new Error("Full name cannot be empty");
            err.statusCode = 400;
            throw err;
        }
        fieldsToUpdate.full_name = full_name.trim();
    }
    if (phone !== undefined) fieldsToUpdate.phone = phone ? phone.trim() : null;
    if (zalo_link !== undefined) fieldsToUpdate.zalo_link = zalo_link ? zalo_link.trim() : null;

    if (role_id !== undefined && role_id !== null) {
        const numRoleId = validateRole(role_id);
        if (numRoleId !== existingUser.role_id) {
            if (adminId && Number(adminId) === numId) {
                const err = new Error("You cannot change your own administrator role");
                err.statusCode = 400;
                throw err;
            }
            if (existingUser.role_id === 1 && existingUser.status === "ACTIVE" && numRoleId !== 1) {
                const activeAdmins = await adminModel.countActiveAdmins(numId);
                if (activeAdmins < 1) {
                    const err = new Error("Cannot change the role of the only active administrator in the system");
                    err.statusCode = 400;
                    throw err;
                }
            }
            fieldsToUpdate.role_id = numRoleId;
            fieldsToUpdate.password_changed_at = new Date().toISOString();
        }
    }

    if (status !== undefined && status !== null) {
        const cleanStatus = validateStatus(status);
        if (cleanStatus !== existingUser.status) {
            if (adminId && Number(adminId) === numId && cleanStatus !== "ACTIVE") {
                const err = new Error("You cannot lock or deactivate your own administrator account");
                err.statusCode = 400;
                throw err;
            }
            if (existingUser.role_id === 1 && existingUser.status === "ACTIVE" && cleanStatus !== "ACTIVE") {
                const activeAdmins = await adminModel.countActiveAdmins(numId);
                if (activeAdmins < 1) {
                    const err = new Error("Cannot lock or deactivate the only active administrator in the system");
                    err.statusCode = 400;
                    throw err;
                }
            }
            fieldsToUpdate.status = cleanStatus;
        }
    }

    if (password !== undefined && password !== null && password !== "") {
        validatePassword(password);
        fieldsToUpdate.password_hash = await bcrypt.hash(password, 10);
        fieldsToUpdate.password_changed_at = new Date().toISOString();
    }

    const updated = await adminModel.updateUser(numId, fieldsToUpdate);

    // Auto-audit log
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "UPDATE_USER",
        targetType: "USER",
        targetId: numId,
        changes: fieldsToUpdate,
        reason: "Administrator updated user details",
        ipAddress
    });

    return updated;
};

const updateUserStatus = async (id, status, adminId = null, ipAddress = null) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    const cleanStatus = validateStatus(status);

    const user = await adminModel.getUserById(numId);
    if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }

    // Safety guard: Admin cannot lock their own account
    if (adminId && Number(adminId) === numId && cleanStatus !== "ACTIVE") {
        const err = new Error("You cannot lock or deactivate your own administrator account");
        err.statusCode = 400;
        throw err;
    }

    // Safety guard: Cannot lock/deactivate the only active administrator
    if (user.role_id === 1 && user.status === "ACTIVE" && cleanStatus !== "ACTIVE") {
        const activeAdmins = await adminModel.countActiveAdmins(numId);
        if (activeAdmins < 1) {
            const err = new Error("Cannot lock or deactivate the only active administrator in the system");
            err.statusCode = 400;
            throw err;
        }
    }

    const updated = await adminModel.updateUserStatus(numId, cleanStatus);

    // Auto-audit log (BUG-ADM-17: Rollback if audit log fails to ensure compliance)
    const action = cleanStatus === "LOCKED" ? "LOCK_USER" : cleanStatus === "ACTIVE" ? "ACTIVATE_USER" : "DEACTIVATE_USER";
    try {
        await adminModel.createActivityLog({
            actorId: adminId,
            actorType: "USER",
            action,
            targetType: "USER",
            targetId: numId,
            changes: { previousStatus: user.status, newStatus: cleanStatus },
            reason: `Administrator changed user status to ${cleanStatus}`,
            ipAddress
        });
    } catch (auditErr) {
        console.error("[AdminService] Critical: Failed to record audit log, rolling back status:", auditErr.message);
        await adminModel.updateUserStatus(numId, user.status);
        const err = new Error("Failed to record activity log. Operation aborted for compliance.");
        err.statusCode = 500;
        throw err;
    }

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
    });

    return updated;
};

// ==========================================
// 6. PERMISSIONS MATRIX (UC-34)
// ==========================================

const getPermissionsMatrix = async () => {
    return await adminModel.getPermissionsMatrix();
};

const updateRolePermissions = async (roleId, permissionIds, adminId = null, ipAddress = null) => {
    const numRoleId = Number(roleId);
    if (!Number.isInteger(numRoleId) || numRoleId <= 0) {
        const err = new Error("Invalid role ID");
        err.statusCode = 400;
        throw err;
    }

    // Không cho phép chỉnh sửa quyền của Administrator (bảo vệ quyền tối cao của Admin)
    if (numRoleId === 1) {
        const err = new Error("Cannot modify permissions of Administrator role");
        err.statusCode = 400;
        throw err;
    }

    // Kiểm tra vai trò hợp lệ (chỉ cho phép sửa 2: MANAGER, 3: DISPATCHER, 4: DRIVER)
    if (![2, 3, 4].includes(numRoleId)) {
        const err = new Error("Role not found or cannot be modified");
        err.statusCode = 404;
        throw err;
    }

    // Validate permissionIds phải là một array
    if (!Array.isArray(permissionIds)) {
        const err = new Error("permissionIds must be an array of permission IDs");
        err.statusCode = 400;
        throw err;
    }

    // Validate và lọc trùng lặp danh sách permissionIds
    const cleanPermIds = [];
    for (const p of permissionIds) {
        const numP = Number(p);
        if (!Number.isInteger(numP) || numP <= 0) {
            const err = new Error(`Invalid permission ID: ${p}. Must be a positive integer`);
            err.statusCode = 400;
            throw err;
        }
        if (!cleanPermIds.includes(numP)) {
            cleanPermIds.push(numP);
        }
    }

    // Validate sự tồn tại của tất cả permissionIds TRƯỚC KHI thực hiện xóa/chèn (tránh lỗi FK và mất dữ liệu)
    if (cleanPermIds.length > 0) {
        const existingIds = await adminModel.getExistingPermissionIds(cleanPermIds);
        const invalidIds = cleanPermIds.filter(id => !existingIds.includes(id));
        if (invalidIds.length > 0) {
            const err = new Error(`Invalid permission ID(s): ${invalidIds.join(", ")}`);
            err.statusCode = 400;
            throw err;
        }
    }

    const result = await adminModel.updateRolePermissions(numRoleId, cleanPermIds);

    // Auto-audit log (UC-35)
    await adminModel.createActivityLog({
        actorId: adminId,
        actorType: "USER",
        action: "UPDATE_ROLE_PERMISSIONS",
        targetType: "ROLE",
        targetId: numRoleId,
        changes: { roleId: numRoleId, permissionIds: cleanPermIds },
        reason: `Administrator updated permissions for role ID ${numRoleId}`,
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
