export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9999/api";

export const API_BASE_URL = API_URL;

export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: "/auth/login",
        LOGOUT: "/auth/logout",
        ME: "/auth/me",// lấy thông tin người dùng hiện tại
        CHANGE_PASSWORD: "/auth/change-password",// thay đổi mật khẩu
    },

    USERS: {
        GET_ALL: "/users",
        GET_BY_ID: (id) => `/users/${id}`,
        CREATE: "/users",
        UPDATE: (id) => `/users/${id}`,
        DELETE: (id) => `/users/${id}`,
    },

    ADMIN: {
        GET_USERS: "/admin/users",
    },

    MANAGER: {
        DASHBOARD_STATS: "/manager/dashboard/stats",
        VEHICLES: "/manager/vehicles",
        DRIVERS: "/manager/drivers",
        ORDERS: "/manager/orders",
        REASSIGN_ORDER: (id) => `/manager/orders/${id}/reassign`,
        VENDORS: "/manager/vendors",
        APPROVE_VENDOR: (id) => `/manager/vendors/${id}/approve`,
        APPROVALS: "/manager/approvals",
        DECIDE_APPROVAL: (id) => `/manager/approvals/${id}/decide`,
    },
};