import { Navigate } from "react-router-dom";
import useAdminAuth from "../hooks/useAdminAuth";

function AdminRoute({ children }) {
    const { isAdminAuthenticated } = useAdminAuth();

    if (!isAdminAuthenticated) {
        return <Navigate to="/admin" replace />;
    }

    return children;
}

export default AdminRoute;