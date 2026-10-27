import { API_URL } from "./apiConfig";

function createResponseError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function parseJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    if (!raw) {
        if (!response.ok) {
            throw createResponseError(
                `Request failed with status ${response.status}`,
                response.status
            );
        }
        return null;
    }

    if (!contentType.includes("application/json")) {
        throw createResponseError(
            response.ok
                ? "Server returned a non-JSON response"
                : `Request failed with status ${response.status}`,
            response.status
        );
    }

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw createResponseError(
            response.ok
                ? "Server returned invalid JSON"
                : `Request failed with status ${response.status}`,
            response.status
        );
    }

    if (!response.ok) {
        throw createResponseError(
            data.message || "Something went wrong",
            response.status
        );
    }

    return data;
}

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

    return parseJsonResponse(response);
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

    return parseJsonResponse(response);
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