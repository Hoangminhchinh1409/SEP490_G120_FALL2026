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
            return res.status(403).json({ message: "Forbidden" });
        }
        
        const userRoleId = Number(req.user.role_id);
        const isAllowedId = [1, 2].includes(userRoleId); // Admin or Manager
        const isAllowedName = roles && (roles.includes(req.user.role) || (userRoleId === 2 && roles.includes("MANAGER")) || (userRoleId === 1 && roles.includes("ADMIN")));

        if (isAllowedId || isAllowedName) {
            return next();
        }
        
        return res.status(403).json({ message: "Forbidden" });
    };
};

module.exports = { requireAuth, requireRole };