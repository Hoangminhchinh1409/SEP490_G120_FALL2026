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
const USER_CACHE_KEY = "nexlog_cached_user";

const readCachedUser = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeCachedUser = (userObj) => {
    if (typeof window === "undefined") return;
    try {
        if (userObj) {
            window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(userObj));
        } else {
            window.sessionStorage.removeItem(USER_CACHE_KEY);
        }
    } catch {
        // ignore storage quota errors
    }
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // Khởi tạo đồng nhất giữa Server & Client để tránh lỗi Hydration Mismatch của Next.js
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    // Đánh dấu user đã thực hiện login/logout
    const authActionRef = useRef(false);

    const setUser = (nextUser) => {
        setUserState((prev) => {
            const resolved = typeof nextUser === "function" ? nextUser(prev) : nextUser;
            writeCachedUser(resolved);
            return resolved;
        });
    };

    // Kiểm tra đăng nhập khi mở ứng dụng
    useEffect(() => {
        // Nạp ngay từ sessionStorage sau khi Hydrate xong (0ms, không cần chờ mạng)
        const cached = readCachedUser();
        if (cached) {
            setUserState(cached);
            setLoading(false);
        }

        const initializeAuth = async () => {
            try {
                const data = await fetchWithAuth(
                    API_ENDPOINTS.AUTH.ME
                );

                if (!authActionRef.current) {
                    setUser(data.user);
                }
            } catch {
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

    const refreshUser = async () => {
        const data = await fetchWithAuth(API_ENDPOINTS.AUTH.ME);
        setUser(data.user);
        return data.user;
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
                refreshUser,
                setUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
