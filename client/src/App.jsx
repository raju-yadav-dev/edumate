import "./App.css";

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Profile from "./pages/Profile/Profile";
import Chat from "./pages/Chat/Chat";
import UserManagement from "./pages/UserManagement/UserManagement";
import KnowledgeStudio from "./pages/KnowledgeStudio/KnowledgeStudio";
import Unauthorized from "./pages/Unauthorized/Unauthorized";
import ProtectedRoute from "./components/common/ProtectedRoute";

function TitleUpdater() {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;
        let title = "Edumate";

        if (path === "/") {
            title = "Edumate | Home";
        } else if (path === "/chat") {
            title = "Edumate | Chat";
        } else if (path === "/login") {
            title = "Edumate | Login";
        } else if (path === "/register") {
            title = "Edumate | Register";
        } else if (path === "/forgot-password") {
            title = "Edumate | Reset Password";
        } else if (path === "/profile") {
            title = "Edumate | Profile";
        } else if (path === "/users") {
            title = "Edumate | User Management";
        } else if (path === "/studio") {
            title = "Edumate | Knowledge Studio";
        } else if (path === "/unauthorized") {
            title = "Edumate | Access Denied";
        }

        document.title = title;
    }, [location]);

    return null;
}

function App() {
    return (
        <BrowserRouter>
            <TitleUpdater />

            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Protected Student / General User Routes */}
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <Chat />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                {/* Protected Admin User Management */}
                <Route
                    path="/users"
                    element={
                        <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                            <UserManagement />
                        </ProtectedRoute>
                    }
                />

                {/* Protected Knowledge Studio Route */}
                <Route
                    path="/studio"
                    element={
                        <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                            <KnowledgeStudio />
                        </ProtectedRoute>
                    }
                />

                {/* Fallback for obsolete admin routes */}
                <Route path="/admin/*" element={<Navigate to="/" replace />} />
                <Route path="/admin" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
