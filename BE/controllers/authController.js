const authService = require("../services/authService");

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                message: "Username/email and password are required"
            });
        }

        const result = await authService.login(
            identifier,
            password
        );

        res.cookie("token", result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "Login successful",
            user: result.user
        });

    } catch (error) {
        return res.status(401).json({
            message: error.message
        });
    }
};


const getMe = async (req, res) => {
    try {
        const user = await authService.getCurrentUser(req.user.id);

        return res.status(200).json({
            user
        });

    } catch (error) {
        return res.status(404).json({
            message: error.message
        });
    }
};


const logout = async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production"
            ? "none"
            : "lax"
    });

    return res.status(200).json({
        message: "Logout successful"
    });
};


module.exports = {
    login,
    getMe,
    logout
};