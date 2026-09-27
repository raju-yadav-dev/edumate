import React from "react";
import useAuth from "../../hooks/useAuth";
import { hasPermission as checkRolePermission, hasAnyPermission as checkRoleAnyPermission } from "../../constants/permissions";

export default function PermissionGuard({
    children,
    permission,
    permissions = [],
    role,
    roles = [],
    fallback = null
}) {
    const { user } = useAuth();
    const userRole = user?.role || "student";

    if (userRole === "super_admin") {
        return children;
    }

    if (role && userRole !== role) {
        return fallback;
    }

    if (roles.length > 0 && !roles.includes(userRole)) {
        return fallback;
    }

    if (permission && !checkRolePermission(userRole, permission)) {
        return fallback;
    }

    if (permissions.length > 0 && !permissions.every(p => checkRolePermission(userRole, p))) {
        return fallback;
    }

    return children;
}
