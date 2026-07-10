import "./AdminConsole.css";

import { Navigate } from "react-router-dom";

import useAuth from "../../../hooks/useAuth";

import Admin from "../Admin";

function AdminConsole() {
    const { user, accessToken } = useAuth();
    const isAdminUser = Boolean(accessToken && user && ["admin", "super_admin"].includes(user.role));

    if (!isAdminUser) {
        return <Navigate to="/admin" replace />;
    }

    return <Admin mode="console" />;
}

export default AdminConsole;