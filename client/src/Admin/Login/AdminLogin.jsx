import "./AdminLogin.css";

import { Navigate } from "react-router-dom";

import useAdminAuth from "../../hooks/useAdminAuth";

import Admin from "../Admin";

function AdminLogin() {
    const { isAdminAuthenticated } = useAdminAuth();

    if (isAdminAuthenticated) {
        return <Navigate to={`/admin/panel${window.location.search}`} replace />;
    }

    return <Admin mode="login" />;
}

export default AdminLogin;