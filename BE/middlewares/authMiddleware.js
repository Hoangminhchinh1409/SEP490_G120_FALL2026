const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const userModel = require('../models/userModel');

let maintenanceCache = {
    value: false,
    timestamp: 0
};

const isMaintenanceActive = async () => {
    const now = Date.now();
    if (now - maintenanceCache.timestamp < 5000) {
        return maintenanceCache.value;
    }
    try {
        const { data } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "maintenance_mode")
            .maybeSingle();
        maintenanceCache.value = data && (data.value === "true" || data.value === true);
        maintenanceCache.timestamp = now;
        return maintenanceCache.value;
    } catch (err) {
        return false;
    }
};

const requireAuth = async (req, res, next) => {
    let decoded;
    try {
        let token = req.cookies?.token;

        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }

    try {
        const sessionState = await userModel.getAuthSessionState(decoded.id);
        const passwordChangedAt = sessionState?.password_changed_at
            ? new Date(sessionState.password_changed_at).getTime()
            : 0;

        if (
            !sessionState ||
            String(sessionState.status).toUpperCase() !== 'ACTIVE' ||
            Number(decoded.pwdv || 0) !== passwordChangedAt
        ) {
            return res.status(401).json({
                message: 'Invalid or expired token'
            });
        }

        // Kiểm tra nếu vai trò đã bị thay đổi trong DB so với token JWT (BUG-ADM-18)
        const dbRoleId = Number(sessionState.role_id);
        const tokenRoleId = Number(decoded.role_id);
        if (dbRoleId && dbRoleId !== tokenRoleId) {
            return res.status(401).json({
                message: "User role has been updated. Please log in again.",
                code: "ROLE_CHANGED"
            });
        }

        // Kiểm tra chế độ bảo trì hệ thống (Report 4 / MSG86)
        if (dbRoleId !== 1) {
            const maintenance = await isMaintenanceActive();
            if (maintenance) {
                return res.status(403).json({
                    message: "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
                    code: "MSG86"
                });
            }
        }

        req.user = {
            ...decoded,
            role_id: dbRoleId || tokenRoleId,
            role: sessionState.role?.name || decoded.role
        };
        return next();
    } catch (error) {
        console.error('Authentication session check failed:', {
            name: error.name,
            code: error.code || null
        });
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

const requireRole = (roles, permissionKey = null) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: "Forbidden: No user in request" });
        }
        
        const userRoleId = Number(req.user.role_id);
        if (userRoleId === 1) return next(); // Administrator luôn có toàn quyền

        const roleMap = {
            1: "ADMINISTRATOR",
            2: "MANAGER",
            3: "DISPATCHER",
            4: "DRIVER"
        };
        const userRoleName = roleMap[userRoleId] || req.user.role || "";
        
        const normalizedRoles = Array.isArray(roles) ? roles : [roles];
        
        const hasPermission = normalizedRoles.some(r => {
            if (typeof r === "number") return r === userRoleId;
            if (String(r).toUpperCase() === "ADMIN" && (userRoleId === 1 || userRoleName === "ADMINISTRATOR")) return true;
            return String(r).toUpperCase() === userRoleName.toUpperCase();
        });

        if (hasPermission) {
            return next();
        }

        // Kiểm tra quyền xem chéo (Read-Only) đối với phương thức đọc (GET / HEAD)
        if (permissionKey && (req.method === 'GET' || req.method === 'HEAD')) {
            try {
                const { data: perm } = await supabase
                    .from('permissions')
                    .select('id')
                    .eq('key', permissionKey)
                    .maybeSingle();

                if (perm) {
                    const { data: rolePerm } = await supabase
                        .from('role_permissions')
                        .select('permission_id')
                        .eq('role_id', userRoleId)
                        .eq('permission_id', perm.id)
                        .maybeSingle();

                    if (rolePerm) {
                        req.isReadOnly = true;
                        return next();
                    }
                }
            } catch (permErr) {
                console.warn('Cross-role permission check error:', permErr.message);
            }
        }
        
        return res.status(403).json({
            message: "Forbidden: You do not have permission to access this resource",
            code: "MSG30"
        });
    };
};

module.exports = { requireAuth, requireRole };
