const { sendError } = require("../utils/response");
const { SELF_REGISTRATION_ROLES } = require("../constants/roles");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => emailPattern.test(String(email || "").toLowerCase());

const collectPasswordErrors = (password) => {
    const errors = [];

    if (!password || password.length < 8) {
        errors.push("Password must be at least 8 characters long.");
    }

    if (!/[A-Z]/.test(password || "")) {
        errors.push("Password must include at least one uppercase letter.");
    }

    if (!/[a-z]/.test(password || "")) {
        errors.push("Password must include at least one lowercase letter.");
    }

    if (!/[0-9]/.test(password || "")) {
        errors.push("Password must include at least one number.");
    }

    if (!/[^A-Za-z0-9]/.test(password || "")) {
        errors.push("Password must include at least one special character.");
    }

    return errors;
};

const validateRegister = (req, res, next) => {
    const errors = [];
    const { fullName, email, password, role } = req.body;
    const normalizedRole = role ? String(role).toLowerCase().trim().replace(/\s+/g, "_") : "student";

    if (!fullName?.trim()) {
        errors.push("Full name is required.");
    }

    if (!isValidEmail(email)) {
        errors.push("A valid email address is required.");
    }

    errors.push(...collectPasswordErrors(password));

    if (!SELF_REGISTRATION_ROLES.includes(normalizedRole)) {
        errors.push("Selected role is not available for self registration.");
    }

    if (errors.length > 0) {
        return sendError(res, 422, "Registration validation failed.", errors);
    }

    return next();
};

const validateLogin = (req, res, next) => {
    const errors = [];
    const { email, password } = req.body;

    if (!isValidEmail(email)) {
        errors.push("A valid email address is required.");
    }

    if (!password) {
        errors.push("Password is required.");
    }

    if (errors.length > 0) {
        return sendError(res, 422, "Login validation failed.", errors);
    }

    return next();
};

const validatePasswordChange = (req, res, next) => {
    const errors = [];

    if (!req.body.currentPassword) {
        errors.push("Current password is required.");
    }

    errors.push(...collectPasswordErrors(req.body.newPassword));

    if (errors.length > 0) {
        return sendError(res, 422, "Password validation failed.", errors);
    }

    return next();
};

const validateForgotPassword = (req, res, next) => {
    const errors = [];

    if (!isValidEmail(req.body.email)) {
        errors.push("A valid email address is required.");
    }

    errors.push(...collectPasswordErrors(req.body.newPassword));

    if (errors.length > 0) {
        return sendError(res, 422, "Password reset validation failed.", errors);
    }

    return next();
};

module.exports = {
    validateRegister,
    validateLogin,
    validatePasswordChange,
    validateForgotPassword,
    collectPasswordErrors,
    isValidEmail
};
