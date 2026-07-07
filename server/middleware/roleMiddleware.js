const { sendError } = require("../utils/response");

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return sendError(res, 401, "Authentication is required.");
    }

    if (!allowedRoles.includes(req.user.role)) {
        return sendError(res, 403, "You do not have permission to access this resource.");
    }

    return next();
};

module.exports = authorizeRoles;
