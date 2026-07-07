const User = require("../models/User");
const { generateAccessToken } = require("../utils/tokenizer");
const AppError = require("../utils/AppError");
const { ADMIN_ROLES, SELF_REGISTRATION_ROLES, USER_ROLES } = require("../constants/roles");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");
const { collectPasswordErrors } = require("../middleware/validationMiddleware");

class AuthError extends AppError {
    constructor(message, statusCode = 400, errors = null) {
        super(message, statusCode, errors);
        this.name = "AuthError";
    }
}

const normalizeEmail = (email) => email?.toLowerCase().trim();

const normalizeRole = (role) => {
    if (!role) {
        return "student";
    }

    return String(role).toLowerCase().trim().replace(/\s+/g, "_");
};

const sanitizeUser = (user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    institution: user.institution,
    department: user.department,
    avatar: user.avatar
});

const buildAuthPayload = (user) => ({
    user: sanitizeUser(user),
    accessToken: generateAccessToken(user)
});

const register = async ({ fullName, email, password, role, institution }) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeRole(role);

    if (!fullName?.trim() || !normalizedEmail || !password) {
        throw new AuthError("Please fill all required fields.", 400);
    }

    if (!SELF_REGISTRATION_ROLES.includes(normalizedRole)) {
        throw new AuthError("Selected role is not available for self registration.", 403);
    }

    const passwordErrors = collectPasswordErrors(password);

    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        throw new AuthError("User already exists.", 409);
    }

    const user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
        role: normalizedRole,
        institution: institution?.trim() || ""
    });

    return buildAuthPayload(user);
};

const hasAdminAccount = async () => {
    const adminCount = await User.countDocuments({
        role: { $in: ADMIN_ROLES },
        status: { $ne: ACCOUNT_STATUS.DELETED }
    });

    return adminCount > 0;
};

const bootstrapAdmin = async ({ fullName, email, password, institution }) => {
    if (await hasAdminAccount()) {
        throw new AuthError("Admin registration is closed. Please sign in with an existing admin account.", 409);
    }

    const normalizedEmail = normalizeEmail(email);

    if (!fullName?.trim() || !normalizedEmail || !password) {
        throw new AuthError("Please fill all required fields.", 400);
    }

    const passwordErrors = collectPasswordErrors(password);

    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
        throw new AuthError("User already exists.", 409);
    }

    const user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
        role: USER_ROLES.SUPER_ADMIN,
        institution: institution?.trim() || "",
        status: ACCOUNT_STATUS.ACTIVE
    });

    return buildAuthPayload(user);
};

const login = async ({ email, password }) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
        throw new AuthError("Email and password are required.", 400);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        throw new AuthError("Invalid email or password.", 401);
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
        throw new AuthError("This account is not active. Please contact your administrator.", 403);
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        throw new AuthError("Invalid email or password.", 401);
    }

    user.lastLoginAt = new Date();
    await user.save();

    return buildAuthPayload(user);
};

const adminLogin = async ({ email, password }) => {
    const authPayload = await login({ email, password });

    if (!ADMIN_ROLES.includes(authPayload.user.role)) {
        throw new AuthError("Admin access is required.", 403);
    }

    return authPayload;
};

const resetPassword = async ({ email, newPassword }) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !newPassword) {
        throw new AuthError("Email and new password are required.", 400);
    }

    const passwordErrors = collectPasswordErrors(newPassword);

    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        throw new AuthError("No account found for this email address.", 404);
    }

    user.password = newPassword;
    await user.save();
};

const changePassword = async ({ userId, currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword) {
        throw new AuthError("Current password and new password are required.", 400);
    }

    const passwordErrors = collectPasswordErrors(newPassword);

    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors);
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new AuthError("Authenticated user no longer exists.", 401);
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
        throw new AuthError("Current password is incorrect.", 401);
    }

    user.password = newPassword;
    await user.save();
};

module.exports = {
    AuthError,
    register,
    bootstrapAdmin,
    hasAdminAccount,
    login,
    adminLogin,
    resetPassword,
    changePassword,
    sanitizeUser
};
