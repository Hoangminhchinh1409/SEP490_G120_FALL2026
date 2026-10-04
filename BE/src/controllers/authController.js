const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { createToken } = require("../utils/auth");

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({ message: "Username/email and password are required" });
        }

        // Find user
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR username = $1",
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = result.rows[0];

        // Check account status
        if (user.status !== "ACTIVE") {
            return res.status(403).json({ message: "Your account is inactive" });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Create JWT
        const token = createToken(user);

        // Remove password from response
        const { password_hash: _, ...userInfo } = user;

        // Store JWT in HttpOnly cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        return res.json({
            message: "Login successful",
            user: userInfo,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error", detail: error.message, stack: error.stack });
    }
};

const getMe = async (req, res) => {
    try {
        const userId = req.user.id; // from requireAuth middleware

        const result = await pool.query(
            `SELECT id, username, email, role, status FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        if (user.status !== "ACTIVE") {
            return res.status(403).json({ message: "Account is inactive" });
        }

        return res.json({ user });
    } catch (error) {
        console.error("GetMe error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const logout = (req, res) => {
    res.clearCookie("token", { path: "/" });
    return res.json({ message: "Logged out successfully" });
};

module.exports = { login, getMe, logout };
