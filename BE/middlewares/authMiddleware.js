const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

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

        req.user = decoded;
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

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: "Forbidden: No user in request" });
        }
        
        const userRoleId = Number(req.user.role_id);
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
        
        return res.status(403).json({ message: "Forbidden: You do not have permission to access this resource" });
    };
};

module.exports = { requireAuth, requireRole };