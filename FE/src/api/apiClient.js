import { API_URL } from "./apiConfig";

// Gọi API có xác thực
export async function fetchWithAuth(url, options = {}) {
    const headers = {
        ...options.headers,
    };

    if (
        options.body &&
        typeof options.body === "string" &&
        !headers["Content-Type"]
    ) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
        credentials: "include",
    });

    if (response.status === 204) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

// Gọi API không yêu cầu xác thực
export async function fetchWithoutAuth(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
        credentials: "include",
    });

    if (response.status === 204) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

// Gọi API upload hoặc tải file
export async function fetchWithAuthFile(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        credentials: "include",
    });

    if (!response.ok) {
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Request failed");
        }

        throw new Error(`Request failed with status ${response.status}`);
    }

    return response;
}