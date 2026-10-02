import { NextResponse } from "next/server";
import { verifyToken } from "./lib/auth";

const allowedOrigin = "http://localhost:3000";

export function middleware(request) {
    const pathname = request.nextUrl.pathname;
    const isAdminApi = pathname.startsWith("/api/admin");

    // Xử lý CORS preflight
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
            },
        });
    }

    if (isAdminApi) {
        const token = request.cookies.get("token")?.value;

        if (!token) {
            return corsResponse(
                NextResponse.json({ message: "Unauthorized" }, { status: 401 })
            );
        }

        try {
            const user = verifyToken(token);

            if (user.role !== "ADMIN") {
                return corsResponse(
                    NextResponse.json({ message: "Forbidden" }, { status: 403 })
                );
            }
        } catch (error) {
            return corsResponse(
                NextResponse.json(
                    { message: "Invalid or expired token" },
                    { status: 401 }
                )
            );
        }
    }

    return corsResponse(NextResponse.next());
}

function corsResponse(response) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
}

export const config = {
    matcher: ["/api/:path*"],
};