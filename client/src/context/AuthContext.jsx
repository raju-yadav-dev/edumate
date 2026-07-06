import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

const STORAGE_KEY = "edumate-user";

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

    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [user]);

    const login = (userData) => {
        setUser(userData);
    };

    const logout = () => {
        setUser(null);
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
                isAuthenticated: Boolean(user)
            }}
        >
            {children}
        </AuthContext.Provider>
    );

}

export default AuthProvider;