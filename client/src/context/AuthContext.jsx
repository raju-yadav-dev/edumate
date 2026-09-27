import React, { useState, useEffect, useCallback, useContext } from "react";
import {
    getStoredAccessToken,
    getStoredRefreshToken,
    getStoredUser,
    saveSession,
    clearSession,
    refreshAccessToken,
    loginUser,
    registerUser,
    logoutUser,
    logoutAllSessions,
    getProfile
} from "../services/authService";
import { hasPermission as checkPermission, hasAnyPermission as checkAnyPermission } from "../constants/permissions";
import { AuthContext } from "./contexts";

export { AuthContext };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getStoredUser());
    const [accessToken, setAccessToken] = useState(() => getStoredAccessToken());
    const [refreshToken, setRefreshToken] = useState(() => getStoredRefreshToken());
    const [isInitializing, setIsInitializing] = useState(true);
    const [sessionError, setSessionError] = useState(null);

    // Initial session restoration on startup
    const initSession = useCallback(async () => {
        const storedToken = getStoredAccessToken();
        const storedRefresh = getStoredRefreshToken();

        if (!storedToken && !storedRefresh) {
            setIsInitializing(false);
            return;
        }

        try {
            // Attempt to get user profile with current access token
            const profile = await getProfile();
            setUser(profile);
            saveSession({ user: profile });
        } catch (err) {
            // If access token failed, attempt refresh
            if (storedRefresh) {
                try {
                    const refreshed = await refreshAccessToken();
                    setUser(refreshed.user);
                    setAccessToken(refreshed.accessToken);
                    setRefreshToken(refreshed.refreshToken);
                } catch (refreshErr) {
                    console.warn("[AuthContext] Session restoration failed:", refreshErr.message);
                    clearSession();
                    setUser(null);
                    setAccessToken(null);
                    setRefreshToken(null);
                }
            } else {
                clearSession();
                setUser(null);
                setAccessToken(null);
                setRefreshToken(null);
            }
        } finally {
            setIsInitializing(false);
        }
    }, []);

    useEffect(() => {
        initSession();
    }, [initSession]);

    // Multi-tab synchronization via storage events
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === "edumate-access-token" || e.key === "edumate-user") {
                const currentToken = getStoredAccessToken();
                const currentUser = getStoredUser();

                if (!currentToken || !currentUser) {
                    setUser(null);
                    setAccessToken(null);
                    setRefreshToken(null);
                } else {
                    setUser(currentUser);
                    setAccessToken(currentToken);
                    setRefreshToken(getStoredRefreshToken());
                }
            }
        };

        const handleSessionExpired = () => {
            setUser(null);
            setAccessToken(null);
            setRefreshToken(null);
            setSessionError("Your session has expired. Please log in again.");
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("edumate:session_expired", handleSessionExpired);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("edumate:session_expired", handleSessionExpired);
        };
    }, []);

    const login = async (credentials) => {
        setSessionError(null);
        let authPayload;
        if (credentials?.email && credentials?.password) {
            authPayload = await loginUser(credentials);
        } else {
            authPayload = credentials;
        }

        const newUser = authPayload.data || authPayload.user;
        const newAccessToken = authPayload.metadata?.accessToken || authPayload.accessToken;
        const newRefreshToken = authPayload.metadata?.refreshToken || authPayload.refreshToken;

        saveSession({
            user: newUser,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

        setUser(newUser);
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);

        return authPayload;
    };

    const signup = async (formData) => {
        setSessionError(null);
        const response = await registerUser(formData);

        const newUser = response.data || response.user;
        const newAccessToken = response.metadata?.accessToken || response.accessToken;
        const newRefreshToken = response.metadata?.refreshToken || response.refreshToken;

        saveSession({
            user: newUser,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

        setUser(newUser);
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);

        return response;
    };

    const logout = async () => {
        // Cancel active audio / speech synthesis if running
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        await logoutUser();
        clearSession();
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setSessionError(null);
    };

    const logoutAll = async () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        await logoutAllSessions();
        clearSession();
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
    };

    const refreshSession = async () => {
        const result = await refreshAccessToken();
        setUser(result.user);
        setAccessToken(result.accessToken);
        setRefreshToken(result.refreshToken);
        return result;
    };

    const updateAvatar = (avatar) => {
        setUser((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, avatar };
            saveSession({ user: updated });
            return updated;
        });
    };

    const hasPermission = (permission) => {
        return checkPermission(user?.role, permission);
    };

    const hasAnyPermission = (permissions) => {
        return checkAnyPermission(user?.role, permissions);
    };

    // Splash screen while checking initial session to prevent white screens or flash of content
    if (isInitializing) {
        return (
            <div
                style={{
                    height: "100vh",
                    width: "100vw",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--background, #0b0f19)",
                    color: "var(--text, #f1f5f9)",
                    fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
                    gap: "16px"
                }}
            >
                <div
                    style={{
                        width: "44px",
                        height: "44px",
                        border: "3px solid rgba(99, 102, 241, 0.2)",
                        borderTopColor: "#6366f1",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                    }}
                />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: "14px", color: "var(--text-light, #94a3b8)", letterSpacing: "0.5px" }}>
                    Initializing EduMate...
                </span>
            </div>
        );
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                refreshToken,
                isAuthenticated: Boolean(user && accessToken),
                isInitializing,
                sessionError,
                login,
                signup,
                logout,
                logoutAll,
                refreshSession,
                updateAvatar,
                hasPermission,
                hasAnyPermission
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export default AuthProvider;
