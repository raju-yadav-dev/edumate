import { getApiRootUrl } from "./apiConfig";

const API_ROOT = getApiRootUrl();
const AUTH_API_BASE_URL = `${API_ROOT}/auth`;
const USER_API_BASE_URL = `${API_ROOT}/users`;

const ACCESS_TOKEN_KEY = "edumate-access-token";
const REFRESH_TOKEN_KEY = "edumate-refresh-token";
const USER_KEY = "edumate-user";

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
    refreshSubscribers.push(callback);
}

function onRefreshed(newAccessToken) {
    refreshSubscribers.forEach((callback) => callback(newAccessToken));
    refreshSubscribers = [];
}

export function getStoredAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function saveSession({ user, accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export async function refreshAccessToken() {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
        clearSession();
        throw new Error("No refresh token available.");
    }

    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            clearSession();
            window.dispatchEvent(new Event("edumate:session_expired"));
            throw new Error(payload.message || "Session expired. Please log in again.");
        }

        const newAccessToken = payload.metadata?.accessToken || payload.accessToken;
        const newRefreshToken = payload.metadata?.refreshToken || payload.refreshToken;
        const updatedUser = payload.data || payload.user;

        saveSession({
            user: updatedUser,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: updatedUser
        };
    } catch (err) {
        clearSession();
        throw err;
    }
}

export async function authFetch(url, options = {}) {
    const token = getStoredAccessToken();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized / Token Expired with Auto-Refresh & Retry
    if (response.status === 401) {
        const originalPayload = await response.clone().json().catch(() => ({}));
        const isExpired = originalPayload.code === "TOKEN_EXPIRED" || response.status === 401;

        if (isExpired && getStoredRefreshToken()) {
            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const refreshed = await refreshAccessToken();
                    isRefreshing = false;
                    onRefreshed(refreshed.accessToken);
                } catch (refreshErr) {
                    isRefreshing = false;
                    refreshSubscribers = [];
                    throw refreshErr;
                }
            }

            // Return a promise that waits for the refresh to finish and retries
            return new Promise((resolve, reject) => {
                subscribeTokenRefresh(async (newToken) => {
                    try {
                        const retryHeaders = {
                            ...headers,
                            Authorization: `Bearer ${newToken}`
                        };
                        const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
                        resolve(retryResponse);
                    } catch (retryErr) {
                        reject(retryErr);
                    }
                });
            });
        }
    }

    return response;
}

export async function registerUser(data) {
    const response = await fetch(`${AUTH_API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        const error = new Error(`${payload.message || "Registration failed."}${validationDetails}`);
        error.code = payload.code;
        error.status = response.status;
        throw error;
    }
    return payload;
}

export async function loginUser(data) {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        const error = new Error(`${payload.message || "Login failed."}${validationDetails}`);
        error.code = payload.code;
        error.status = response.status;
        error.retryAfterSeconds = payload.retryAfterSeconds;
        throw error;
    }
    return payload;
}

export async function logoutUser() {
    const refreshToken = getStoredRefreshToken();
    const token = getStoredAccessToken();

    try {
        await fetch(`${AUTH_API_BASE_URL}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ refreshToken })
        });
    } catch (e) {
        console.warn("Logout request failed:", e);
    } finally {
        clearSession();
    }
}

export async function logoutAllSessions() {
    const token = getStoredAccessToken();
    try {
        await fetch(`${AUTH_API_BASE_URL}/logout-all`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        });
    } finally {
        clearSession();
    }
}

export async function getProfile() {
    const response = await authFetch(`${AUTH_API_BASE_URL}/profile`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.message || "Failed to retrieve user profile.");
    }

    return payload.data || payload.user;
}

export async function forgotPassword(data) {
    const response = await fetch(`${AUTH_API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Password reset request failed.");
    }
    return payload;
}

export async function updateProfileAvatar(userId, file) {
    const formData = new FormData();
    formData.append("avatar", file);
    const token = getStoredAccessToken();

    const response = await fetch(`${USER_API_BASE_URL}/${userId}/avatar`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Unable to update profile photo.");
    }
    return payload;
}
