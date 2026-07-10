import "./AdminLogin.css";

import { Navigate } from "react-router-dom";

import useAuth from "../../../hooks/useAuth";

import Admin from "../Admin";

function AdminLogin() {
    const { user, accessToken } = useAuth();
    const isAdminUser = Boolean(accessToken && user && ["admin", "super_admin"].includes(user.role));

    if (isAdminUser) {
        return <Navigate to="/admin/panel" replace />;
    }

    return <Admin mode="login" />;
}

export default AdminLogin;