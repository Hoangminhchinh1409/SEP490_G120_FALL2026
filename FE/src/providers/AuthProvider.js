"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
} from "react";

import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "../api/apiConfig";
import {
    fetchWithAuth,
    fetchWithoutAuth,
} from "../api/apiClient";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    // Đánh dấu user đã thực hiện login/logout
    const authActionRef = useRef(false);

    // Kiểm tra đăng nhập khi mở ứng dụng
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const data = await fetchWithAuth(
                    API_ENDPOINTS.AUTH.ME
                );

                // Nếu trong lúc kiểm tra mà user đã login
                // thì không ghi đè user hiện tại
                if (!authActionRef.current) {
                    setUser(data.user);
                }
            } catch (error) {
                // Nếu user chưa thực hiện login
                // thì mới set user = null
                if (!authActionRef.current) {
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Chuyển hướng theo role
    const redirectByRole = (roleId) => {
        console.log("REDIRECT ROLE:", roleId);

        switch (Number(roleId)) {
            case 1:
                router.push("/admin");
                break;

            case 2:
                router.push("/manager");
                break;

            case 3:
                router.push("/dispatcher");
                break;

            case 4:
                router.push("/driver");
                break;

            default:
                console.log("Unknown role:", roleId);
                router.push("/");
        }
    };

    // Đăng nhập
    const login = async (identifier, password) => {
        const data = await fetchWithoutAuth(
            API_ENDPOINTS.AUTH.LOGIN,
            {
                method: "POST",
                body: JSON.stringify({
                    identifier,
                    password,
                }),
            }
        );

        console.log("LOGIN RESPONSE:", data);
        console.log("ROLE:", data.user?.role_id);

        // Đánh dấu login đã xảy ra
        authActionRef.current = true;

        setUser(data.user);

        redirectByRole(data.user.role_id);

        return data;
    };

    // Đăng xuất
    const logout = async () => {
        try {
            await fetchWithAuth(
                API_ENDPOINTS.AUTH.LOGOUT,
                {
                    method: "POST",
                }
            );
        } finally {
            authActionRef.current = true;
            setUser(null);
            router.push("/login");
        }
    };

    // Kiểm tra quyền
    const hasRole = (allowedRoles) => {
        if (!user) return false;

        return allowedRoles.includes(user.role_id);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                loading,
                hasRole,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};