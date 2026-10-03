export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9999/api";

export const API_BASE_URL = API_URL;

export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: "/auth/login",
        LOGOUT: "/auth/logout",
        ME: "/auth/me",
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

};