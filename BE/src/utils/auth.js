const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// Tạo JWT
function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        JWT_SECRET,
        {
            expiresIn: "1d",
        }
    );
}

// Kiểm tra JWT
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { createToken, verifyToken };
