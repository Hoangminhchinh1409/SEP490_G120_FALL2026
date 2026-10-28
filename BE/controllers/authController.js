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
        return res.status(error.statusCode || 401).json({
            message: error.message,
            code: error.code || null
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
        const statusCode = error.message === "User not found" ? 404 : 500;
        return res.status(statusCode).json({
            message: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await authService.changePassword(
            req.user.id,
            currentPassword,
            newPassword
        );

        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || null
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.requestPasswordReset(email);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || null
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const result = await authService.resetPasswordWithToken(token, newPassword);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            message: error.message,
            code: error.code || null
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
    changePassword,
    forgotPassword,
    resetPassword,
    logout
};