const adminService = require("../services/adminService");

// Helper to extract client IP address
const getClientIp = (req) => {
    return req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || "127.0.0.1";
};

// ==========================================
// 1. DASHBOARD STATS
// ==========================================

const getDashboardStats = async (req, res) => {
    try {
        const stats = await adminService.getDashboardStats();
        return res.status(200).json({
            message: "Success",
            stats
        });
    } catch (error) {
        console.error("[AdminController] getDashboardStats error:", error);
        return res.status(500).json({
            message: "Failed to fetch dashboard stats",
            error: error.message
        });
    }
};

// ==========================================
// 2. ACTIVITY LOGS
// ==========================================

const getActivityLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            actorId,
            action,
            targetType,
            startDate,
            endDate,
            keyword
        } = req.query;

        const result = await adminService.getActivityLogs({
            page,
            limit,
            actorId,
            action,
            targetType,
            startDate,
            endDate,
            keyword
        });

        return res.status(200).json({
            message: "Success",
            ...result
        });
    } catch (error) {
        console.error("[AdminController] getActivityLogs error:", error);
        return res.status(500).json({
            message: "Failed to fetch activity logs",
            error: error.message
        });
    }
};

// ==========================================
// 3. USER MANAGEMENT
// ==========================================

const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, roleId, status, keyword } = req.query;

        const result = await adminService.getUsers({
            page,
            limit,
            roleId,
            status,
            keyword
        });

        return res.status(200).json({
            message: "Success",
            ...result
        });
    } catch (error) {
        console.error("[AdminController] getUsers error:", error);
        return res.status(500).json({
            message: "Failed to fetch users",
            error: error.message
        });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await adminService.getUserById(id);

        return res.status(200).json({
            message: "Success",
            user
        });
    } catch (error) {
        console.error(`[AdminController] getUserById error for id ${req.params.id}:`, error);
        const status = error.message === "User not found" ? 404 : 500;
        return res.status(status).json({
            message: "Failed to fetch user details",
            error: error.message
        });
    }
};

const createUser = async (req, res) => {
    try {
        const adminId = req.user?.id;
        const ipAddress = getClientIp(req);

        const newUser = await adminService.createUser(req.body, adminId, ipAddress);

        return res.status(201).json({
            message: "User created successfully",
            user: newUser
        });
    } catch (error) {
        console.error("[AdminController] createUser error:", error);
        const isConflict = error.message.includes("already exists");
        const status = isConflict ? 409 : 400;
        return res.status(status).json({
            message: "Failed to create user",
            error: error.message
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        const ipAddress = getClientIp(req);

        const updatedUser = await adminService.updateUser(id, req.body, adminId, ipAddress);

        return res.status(200).json({
            message: "User updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error(`[AdminController] updateUser error for id ${req.params.id}:`, error);
        const isConflict = error.message.includes("already taken");
        const isNotFound = error.message === "User not found";
        const status = isNotFound ? 404 : isConflict ? 409 : 400;
        return res.status(status).json({
            message: "Failed to update user",
            error: error.message
        });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const adminId = req.user?.id;
        const ipAddress = getClientIp(req);

        if (!status) {
            return res.status(400).json({
                message: "Status is required"
            });
        }

        const updatedUser = await adminService.updateUserStatus(id, status, adminId, ipAddress);

        return res.status(200).json({
            message: `User status updated to ${status} successfully`,
            user: updatedUser
        });
    } catch (error) {
        console.error(`[AdminController] updateUserStatus error for id ${req.params.id}:`, error);
        const isNotFound = error.message === "User not found";
        const status = isNotFound ? 404 : 400;
        return res.status(status).json({
            message: "Failed to update user status",
            error: error.message
        });
    }
};

// ==========================================
// 4. ROLES
// ==========================================

const getRoles = async (req, res) => {
    try {
        const roles = await adminService.getRoles();
        return res.status(200).json({
            message: "Success",
            roles
        });
    } catch (error) {
        console.error("[AdminController] getRoles error:", error);
        return res.status(500).json({
            message: "Failed to fetch roles",
            error: error.message
        });
    }
};

// ==========================================
// 5. SYSTEM SETTINGS
// ==========================================

const getSystemSettings = async (req, res) => {
    try {
        const settings = await adminService.getSystemSettings();
        return res.status(200).json({
            message: "Success",
            settings
        });
    } catch (error) {
        console.error("[AdminController] getSystemSettings error:", error);
        return res.status(500).json({
            message: "Failed to fetch system settings",
            error: error.message
        });
    }
};

const updateSystemSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        const adminId = req.user?.id;
        const ipAddress = getClientIp(req);

        if (!key) {
            return res.status(400).json({
                message: "Setting key is required"
            });
        }

        const setting = await adminService.updateSystemSetting(key, value, adminId, ipAddress);

        return res.status(200).json({
            message: "Setting updated successfully",
            setting
        });
    } catch (error) {
        console.error("[AdminController] updateSystemSetting error:", error);
        return res.status(400).json({
            message: "Failed to update system setting",
            error: error.message
        });
    }
};

// ==========================================
// 6. PERMISSIONS MATRIX (UC-34)
// ==========================================

const getPermissionsMatrix = async (req, res) => {
    try {
        const matrix = await adminService.getPermissionsMatrix();
        return res.status(200).json({
            message: "Success",
            ...matrix
        });
    } catch (error) {
        console.error("[AdminController] getPermissionsMatrix error:", error);
        return res.status(500).json({
            message: "Failed to fetch permissions matrix",
            error: error.message
        });
    }
};

const updateRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissionIds = [] } = req.body;
        const adminId = req.user?.id;
        const ipAddress = getClientIp(req);

        if (!roleId) {
            return res.status(400).json({
                message: "Role ID is required"
            });
        }

        const result = await adminService.updateRolePermissions(roleId, permissionIds, adminId, ipAddress);

        return res.status(200).json({
            message: "Role permissions updated successfully",
            ...result
        });
    } catch (error) {
        console.error(`[AdminController] updateRolePermissions error for roleId ${req.params.roleId}:`, error);
        return res.status(400).json({
            message: "Failed to update role permissions",
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getActivityLogs,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    updateUserStatus,
    getRoles,
    getSystemSettings,
    updateSystemSetting,
    getPermissionsMatrix,
    updateRolePermissions
};
