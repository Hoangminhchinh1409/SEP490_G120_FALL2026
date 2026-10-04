const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
    try {
        const token = req.cookies.token;

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
        
        if (roles.includes(req.user.role) || [1, 2].includes(req.user.role_id)) {
            return next();
        }
        
        return res.status(403).json({ message: "Forbidden" });
    };
};

module.exports = { requireAuth, requireRole };