import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { hasPermission as checkRolePermission, hasAnyPermission as checkRoleAnyPermission } from "../../constants/permissions";

export default function ProtectedRoute({
    children,
    requiredRole,
    requiredRoles,
    requiredPermission,
    requiredPermissions,
    redirectPath = "/login"
}) {
    const { user, isAuthenticated, isInitializing } = useAuth();
    const location = useLocation();

    if (isInitializing) {
        return (
            <div
                style={{
                    height: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--background, #0b0f19)"
                }}
            >
                <div
                    style={{
                        width: "36px",
                        height: "36px",
                        border: "3px solid rgba(99, 102, 241, 0.2)",
                        borderTopColor: "#6366f1",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                    }}
                />
            </div>
        );
    }

    // If not authenticated, redirect to login preserving destination in location state
    if (!isAuthenticated || !user) {
        return <Navigate to={redirectPath} state={{ from: location }} replace />;
    }

    const userRole = user.role || "student";

    // Check Role constraints
    if (requiredRole && userRole !== requiredRole && userRole !== "super_admin") {
        return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }

    if (requiredRoles && Array.isArray(requiredRoles)) {
        const hasValidRole = requiredRoles.includes(userRole) || userRole === "super_admin";
        if (!hasValidRole) {
            return <Navigate to="/unauthorized" state={{ from: location }} replace />;
        }
    }

    // Check Permission constraints
    if (requiredPermission && !checkRolePermission(userRole, requiredPermission)) {
        return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }

    if (requiredPermissions && Array.isArray(requiredPermissions)) {
        const hasAllPerms = requiredPermissions.every(p => checkRolePermission(userRole, p));
        if (!hasAllPerms) {
            return <Navigate to="/unauthorized" state={{ from: location }} replace />;
        }
    }

    return children;
}
