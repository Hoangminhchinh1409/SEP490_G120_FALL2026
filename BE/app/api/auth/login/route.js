import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "../../../../lib/db";
import { createToken } from "../../../../lib/auth";

export async function POST(request) {
    try {
        const { identifier, password } = await request.json();

        // Validate input
        if (!identifier || !password) {
            return NextResponse.json(
                { message: "Username/email and password are required" },
                { status: 400 }
            );
        }

        // Find user
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR username = $1",
            [identifier]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const user = result.rows[0];

        // Check account status
        if (user.status !== "ACTIVE") {
            return NextResponse.json(
                { message: "Your account is inactive" },
                { status: 403 }
            );
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Create JWT
        const token = createToken(user);

        // Remove password from response
        const { password: _, ...userInfo } = user;

        const response = NextResponse.json({
            message: "Login successful",
            user: userInfo,
        });

        // Store JWT in HttpOnly cookie
        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);

        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}