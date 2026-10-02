import { NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { createToken } from "../../../../lib/auth";

export async function GET(request) {
    try {
        const token = request.cookies.get("token")?.value;

        if (!token) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        const decoded = verifyToken(token);

        const result = await pool.query(
            `SELECT id, email, role, status
             FROM users
             WHERE id = $1`,
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { message: "User not found" },
                { status: 404 }
            );
        }

        const user = result.rows[0];

        if (user.status !== "ACTIVE") {
            return NextResponse.json(
                { message: "Account is inactive" },
                { status: 403 }
            );
        }

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json(
            { message: "Invalid or expired token" },
            { status: 401 }
        );
    }
}