const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userModel = require("../models/userModel");

const login = async (identifier, password) => {
    const user = await userModel.findUserByIdentifier(identifier);

    if (!user) {
        throw new Error("Invalid username/email or password");
    }

    if (user.status !== "ACTIVE") {
        throw new Error("Account is not active");
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!isPasswordValid) {
        throw new Error("Invalid username/email or password");
    }

    const updatedUser = await userModel.updateLastLogin(user.id);

    const token = jwt.sign(
        {
            id: updatedUser.id,
            username: updatedUser.username,
            role_id: updatedUser.role_id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d"
        }
    );

    return {
        token,
        user: {
            id: updatedUser.id,
            username: updatedUser.username,
            full_name: updatedUser.full_name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            zalo_link: updatedUser.zalo_link,
            role_id: updatedUser.role_id,
            status: updatedUser.status
        }
    };
};


const getCurrentUser = async (userId) => {
    const user = await userModel.findUserById(userId);

    if (!user) {
        throw new Error("User not found");
    }

    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        zalo_link: user.zalo_link,
        role_id: user.role_id,
        status: user.status
    };
};


module.exports = {
    login,
    getCurrentUser
};