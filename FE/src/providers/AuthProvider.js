"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
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

    // Kiểm tra đăng nhập khi mở ứng dụng
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const data = await fetchWithAuth(
                    API_ENDPOINTS.AUTH.ME
                );

                setUser(data.user);
            } catch (error) {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Chuyển hướng theo role
    const redirectByRole = (role) => {
        switch (role) {
            case "ADMIN":
            case "ADMINISTRATOR":
                router.push("/admin");
                break;

            case "MANAGER":
                router.push("/manager");
                break;

            case "DISPATCHER":
                router.push("/dispatcher");
                break;

            case "DRIVER":
                router.push("/driver");
                break;

            default:
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

        setUser(data.user);
        redirectByRole(data.user.role);

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
            setUser(null);
            router.push("/login");
        }
    };

    // Kiểm tra quyền
    const hasRole = (allowedRoles) => {
        if (!user) return false;
        return allowedRoles.includes(user.role);
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