import { getApiRootUrl } from "./apiConfig";
import { authFetch } from "./authService";

const API_ROOT = getApiRootUrl();
const USERS_API_URL = `${API_ROOT}/users`;
const USERS_FALLBACK_URL = `${API_ROOT.replace(/\/v1$/, "")}/users`;

async function requestUsers(pathSuffix = "", options = {}) {
    let response = await authFetch(`${USERS_API_URL}${pathSuffix}`, options);
    if (response.status === 404 && USERS_FALLBACK_URL !== USERS_API_URL) {
        response = await authFetch(`${USERS_FALLBACK_URL}${pathSuffix}`, options);
    }
    return response;
}

export async function fetchUsers({ page = 1, limit = 50, search = "", role = "", status = "" } = {}) {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await requestUsers(query);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.message || "Failed to load users.");
    }

    return {
        users: payload.data || [],
        pagination: payload.pagination || { total: 0, page: 1, limit: 50, pages: 1 }
    };
}

export async function updateUser(userId, data) {
    const response = await requestUsers(`/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.message || "Failed to update user.");
    }

    return payload.data;
}

export async function createUser(data) {
    const response = await requestUsers("", {
        method: "POST",
        body: JSON.stringify(data)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.message || "Failed to create user.");
    }

    return payload.data;
}

export async function deleteUser(userId) {
    const response = await requestUsers(`/${userId}`, {
        method: "DELETE"
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.message || "Failed to delete user.");
    }

    return payload.data;
}
