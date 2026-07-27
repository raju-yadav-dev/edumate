import { useEffect, useState } from "react";
import { AuthContext } from "./contexts";

const STORAGE_KEY = "edumate-user";
const TOKEN_KEY = "edumate-access-token";

function readStoredUser() {
    const storedUser = localStorage.getItem(STORAGE_KEY);

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch {
        return null;
    }
}

function AuthProvider({ children }) {

    const [user, setUser] = useState(() => readStoredUser());
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY));

    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [user]);

    useEffect(() => {
        if (accessToken) {
            localStorage.setItem(TOKEN_KEY, accessToken);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }, [accessToken]);

    const login = (userData, token) => {
        if (userData) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
        setUser(userData);
        setAccessToken(token || null);
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setAccessToken(null);
    };

    const updateAvatar = (avatar) => {
        setUser((currentUser) => {
            if (!currentUser) {
                return currentUser;
            }

            return {
                ...currentUser,
                avatar
            };
        });
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                updateAvatar,
                accessToken,
                isAuthenticated: Boolean(user && accessToken)
            }}
        >
            {children}
        </AuthContext.Provider>
    );

}

export default AuthProvider;
