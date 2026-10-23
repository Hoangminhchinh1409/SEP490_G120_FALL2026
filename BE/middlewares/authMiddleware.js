const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
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

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
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