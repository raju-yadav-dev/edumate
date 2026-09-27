const { hasPermission, hasAnyPermission } = require("../constants/permissions");
const { USER_ROLES } = require("../constants/roles");

const authorizePermissions = (...requiredPermissions) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: "MISSING_TOKEN",
            message: "Authentication is required."
        });
    }

    const userRole = req.user.role || "student";

    if (userRole === USER_ROLES.SUPER_ADMIN) {
        return next();
    }

    const hasAll = requiredPermissions.every(perm => hasPermission(userRole, perm));

    if (!hasAll) {
        return res.status(403).json({
            success: false,
            code: "PERMISSION_DENIED",
            message: "You do not have permission to perform this action.",
            requiredPermissions
        });
    }

    return next();
};

const requireDepartmentOwnership = (fieldKey = "department") => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: "MISSING_TOKEN",
            message: "Authentication is required."
        });
    }

    const userRole = req.user.role || "student";

    if (userRole === USER_ROLES.SUPER_ADMIN || userRole === USER_ROLES.ADMIN) {
        return next();
    }

    const targetDept = req.body?.[fieldKey] || req.query?.[fieldKey] || req.params?.[fieldKey] || "";
    const userDept = req.user.department || "";

    if (userRole === USER_ROLES.FACULTY || userRole === USER_ROLES.TEACHER) {
        if (!userDept || (targetDept && targetDept.toLowerCase().trim() !== userDept.toLowerCase().trim())) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: `You can only manage resources for your assigned department (${userDept || "None"}).`
            });
        }
    }

    return next();
};

module.exports = {
    authorizePermissions,
    requireDepartmentOwnership
};
