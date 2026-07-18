import "./AdminConsole.css";

import { Navigate } from "react-router-dom";

import useAdminAuth from "../../hooks/useAdminAuth";

import Admin from "../Admin";

function AdminConsole() {
    const { isAdminAuthenticated } = useAdminAuth();

    if (!isAdminAuthenticated) {
        return <Navigate to="/admin" replace />;
    }

    return (
        <div className="admin-console-screen">
            <Admin mode="console" />
        </div>
    );
}

export default AdminConsole;