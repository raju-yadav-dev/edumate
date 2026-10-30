const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    hashToken
} = require("../utils/tokenizer");
const AppError = require("../utils/AppError");
const { ADMIN_ROLES, SELF_REGISTRATION_ROLES, USER_ROLES } = require("../constants/roles");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");
const { collectPasswordErrors } = require("../middleware/validationMiddleware");
const { logAuditEvent, AUDIT_ACTIONS } = require("./auditService");

class AuthError extends AppError {
    constructor(message, statusCode = 400, errors = null, code = "AUTH_ERROR") {
        super(message, statusCode, errors);
        this.name = "AuthError";
        this.code = code;
    }
}

const normalizeEmail = (email) => email?.toLowerCase().trim();

const normalizeRole = (role) => {
    if (!role) return "student";
    return String(role).toLowerCase().trim().replace(/\s+/g, "_");
};

const sanitizeUser = (user) => ({
    id: user._id ? user._id.toString() : String(user.id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    institution: user.institution || "",
    department: user.department || "",
    avatar: user.avatar || "",
    failedLoginAttempts: user.failedLoginAttempts || 0,
    status: user.status,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null
});

const createSession = async (user, sessionInfo = {}) => {
    const { token, sessionId } = generateRefreshToken(user, sessionInfo.sessionId);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshToken.create({
        userId: user._id,
        tokenHash,
        sessionId,
        deviceName: sessionInfo.deviceName || "Web Client",
        browser: sessionInfo.browser || "Browser",
        os: sessionInfo.os || "OS",
        ipAddress: sessionInfo.ipAddress || "",
        expiresAt,
        lastUsedAt: new Date(),
        isRevoked: false
    });

    const accessToken = generateAccessToken(user);

    return {
        accessToken,
        refreshToken: token,
        sessionId
    };
};

const buildAuthPayload = async (user, sessionInfo = {}) => {
    const tokens = await createSession(user, sessionInfo);

    return {
        user: sanitizeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId
    };
};

const register = async ({ fullName, email, password, role, institution }, sessionInfo = {}) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeRole(role);

    if (!fullName?.trim() || !normalizedEmail || !password) {
        throw new AuthError("Please fill all required fields.", 400, null, "VALIDATION_ERROR");
    }

    if (!SELF_REGISTRATION_ROLES.includes(normalizedRole)) {
        throw new AuthError("Selected role is not available for self registration.", 403, null, "ROLE_NOT_ALLOWED");
    }

    const passwordErrors = collectPasswordErrors(password);
    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors, "INVALID_PASSWORD");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        throw new AuthError("User already exists with this email address.", 409, null, "USER_ALREADY_EXISTS");
    }

    const user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
        role: normalizedRole,
        institution: institution?.trim() || ""
    });

    await logAuditEvent({
        userId: user._id,
        email: user.email,
        role: user.role,
        action: AUDIT_ACTIONS.SIGNUP_SUCCESS,
        ipAddress: sessionInfo.ipAddress || "",
        userAgent: sessionInfo.userAgent || "",
        success: true
    });

    return await buildAuthPayload(user, sessionInfo);
};

const hasAdminAccount = async () => {
    const adminCount = await User.countDocuments({
        role: { $in: ADMIN_ROLES },
        status: { $ne: ACCOUNT_STATUS.DELETED }
    });

    return adminCount > 0;
};

const bootstrapAdmin = async ({ fullName, email, password, institution }, sessionInfo = {}) => {
    if (await hasAdminAccount()) {
        throw new AuthError("Admin registration is closed. Please sign in with an existing admin account.", 409, null, "ADMIN_EXISTS");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!fullName?.trim() || !normalizedEmail || !password) {
        throw new AuthError("Please fill all required fields.", 400, null, "VALIDATION_ERROR");
    }

    const passwordErrors = collectPasswordErrors(password);
    if (passwordErrors.length > 0) {
        throw new AuthError("Password does not meet security requirements.", 422, passwordErrors, "INVALID_PASSWORD");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        throw new AuthError("User already exists.", 409, null, "USER_ALREADY_EXISTS");
    }

    const user = await User.create({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
        role: USER_ROLES.SUPER_ADMIN,
        institution: institution?.trim() || "",
        status: ACCOUNT_STATUS.ACTIVE
    });

    await logAuditEvent({
        userId: user._id,
        email: user.email,
        role: user.role,
        action: AUDIT_ACTIONS.SIGNUP_SUCCESS,
        ipAddress: sessionInfo.ipAddress || "",
        userAgent: sessionInfo.userAgent || "",
        success: true,
        metadata: { isBootstrapAdmin: true }
    });

    return await buildAuthPayload(user, sessionInfo);
};

const login = async ({ email, password }, sessionInfo = {}) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
        throw new AuthError("Email and password are required.", 400, null, "VALIDATION_ERROR");
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        await logAuditEvent({
            email: normalizedEmail,
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            ipAddress: sessionInfo.ipAddress || "",
            userAgent: sessionInfo.userAgent || "",
            success: false,
            errorCode: "USER_NOT_FOUND"
        });
        throw new AuthError("Invalid email or password.", 401, null, "INVALID_CREDENTIALS");
    }

    // Check Account Lock
    if (user.isLocked()) {
        const remainingMinutes = Math.ceil((user.accountLockedUntil - Date.now()) / (60 * 1000));
        await logAuditEvent({
            userId: user._id,
            email: user.email,
            role: user.role,
            action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
            ipAddress: sessionInfo.ipAddress || "",
            userAgent: sessionInfo.userAgent || "",
            success: false,
            errorCode: "ACCOUNT_LOCKED"
        });
        throw new AuthError(
            `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
            403,
            null,
            "ACCOUNT_LOCKED"
        );
    }

    if (user.status !== ACCOUNT_STATUS.ACTIVE) {
        throw new AuthError("This account is not active. Please contact your administrator.", 403, null, "ACCOUNT_INACTIVE");
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        await user.incrementFailedAttempts();
        await logAuditEvent({
            userId: user._id,
            email: user.email,
            role: user.role,
            action: AUDIT_ACTIONS.LOGIN_FAILURE,
            ipAddress: sessionInfo.ipAddress || "",
            userAgent: sessionInfo.userAgent || "",
            success: false,
            errorCode: "INVALID_PASSWORD",
            metadata: { failedAttempts: user.failedLoginAttempts }
        });
        throw new AuthError("Invalid email or password.", 401, null, "INVALID_CREDENTIALS");
    }

    // Reset failed attempts on successful login
    await user.resetFailedAttempts();
    user.lastLoginAt = new Date();
    await user.save();

    await logAuditEvent({
        userId: user._id,
        email: user.email,
        role: user.role,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        ipAddress: sessionInfo.ipAddress || "",
        userAgent: sessionInfo.userAgent || "",
        success: true
    });

    return await buildAuthPayload(user, sessionInfo);
};

const adminLogin = async ({ email, password }, sessionInfo = {}) => {
    const authPayload = await login({ email, password }, sessionInfo);

    if (!ADMIN_ROLES.includes(authPayload.user.role)) {
        throw new AuthError("Access denied. Admin privileges required.", 403, null, "FORBIDDEN");
    }

    return authPayload;
};

const refreshSessionToken = async ({ refreshToken: rawToken }, sessionInfo = {}) => {
    if (!rawToken) {
        throw new AuthError("Refresh token is required.", 400, null, "MISSING_TOKEN");
    }

    let decoded;
    try {
        decoded = verifyRefreshToken(rawToken);
    } catch (err) {
        throw new AuthError("Invalid or expired refresh token.", 401, null, "REFRESH_TOKEN_EXPIRED");
    }

    const tokenHash = hashToken(rawToken);
    const existingSession = await RefreshToken.findOne({
        tokenHash,
        isRevoked: false
    });

    if (!existingSession) {
        await logAuditEvent({
            userId: decoded.id,
            action: AUDIT_ACTIONS.TOKEN_REFRESH,
            ipAddress: sessionInfo.ipAddress || "",
            userAgent: sessionInfo.userAgent || "",
            success: false,
            errorCode: "REVOKED_SESSION"
        });
        throw new AuthError("Refresh token has been revoked or expired. Please sign in again.", 401, null, "REVOKED_SESSION");
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user || user.status !== ACCOUNT_STATUS.ACTIVE) {
        throw new AuthError("User account is no longer active.", 401, null, "USER_NOT_FOUND");
    }

    // Single-use token rotation: revoke old token
    existingSession.isRevoked = true;
    await existingSession.save();

    // Issue new session
    const newSession = await createSession(user, {
        ...sessionInfo,
        sessionId: existingSession.sessionId
    });

    await logAuditEvent({
        userId: user._id,
        email: user.email,
        role: user.role,
        action: AUDIT_ACTIONS.TOKEN_REFRESH,
        ipAddress: sessionInfo.ipAddress || "",
        userAgent: sessionInfo.userAgent || "",
        success: true
    });

    return {
        user: sanitizeUser(user),
        accessToken: newSession.accessToken,
        refreshToken: newSession.refreshToken,
        sessionId: newSession.sessionId
    };
};

const logout = async ({ refreshToken: rawToken, userId }, sessionInfo = {}) => {
    if (rawToken) {
        const tokenHash = hashToken(rawToken);
        await RefreshToken.updateMany(
            { tokenHash },
            { $set: { isRevoked: true } }
        );
    }

    if (userId) {
        await logAuditEvent({
            userId,
            action: AUDIT_ACTIONS.LOGOUT,
            ipAddress: sessionInfo.ipAddress || "",
            userAgent: sessionInfo.userAgent || "",
            success: true
        });
    }

    return { success: true };
};

const logoutAllSessions = async (userId, sessionInfo = {}) => {
    if (!userId) throw new AuthError("User ID is required.", 400, null, "VALIDATION_ERROR");

    await RefreshToken.updateMany(
        { userId, isRevoked: false },
        { $set: { isRevoked: true } }
    );

    await logAuditEvent({
        userId,
        action: AUDIT_ACTIONS.LOGOUT_ALL,
        ipAddress: sessionInfo.ipAddress || "",
        userAgent: sessionInfo.userAgent || "",
        success: true
    });

    return { success: true };
};

const resetPassword = async ({ email, currentPassword, newPassword, role }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !currentPassword || !newPassword) {
        throw new AuthError("Email, current password, and new password are required.", 400, null, "VALIDATION_ERROR");
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        throw new AuthError("Invalid account credentials.", 401, null, "INVALID_CREDENTIALS");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new AuthError("Current password is incorrect.", 401, null, "INVALID_PASSWORD");
    }

    const passwordErrors = collectPasswordErrors(newPassword);
    if (passwordErrors.length > 0) {
        throw new AuthError("New password does not meet security requirements.", 422, passwordErrors, "INVALID_PASSWORD");
    }

    user.password = newPassword;
    await user.save();

    // Invalidate existing sessions on password change
    await RefreshToken.updateMany({ userId: user._id }, { $set: { isRevoked: true } });

    return { success: true };
};

const changePassword = async ({ userId, currentPassword, newPassword }) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AuthError("User not found.", 404, null, "USER_NOT_FOUND");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new AuthError("Current password is incorrect.", 401, null, "INVALID_PASSWORD");
    }

    const passwordErrors = collectPasswordErrors(newPassword);
    if (passwordErrors.length > 0) {
        throw new AuthError("New password does not meet security requirements.", 422, passwordErrors, "INVALID_PASSWORD");
    }

    user.password = newPassword;
    await user.save();

    // Revoke other sessions
    await RefreshToken.updateMany({ userId: user._id }, { $set: { isRevoked: true } });

    return { success: true };
};

const getAuthMetrics = async () => {
    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
        activeSessions,
        lockedAccounts,
        recentLogins24h,
        failedLogins24h,
        totalUsers
    ] = await Promise.all([
        RefreshToken.countDocuments({ isRevoked: false, expiresAt: { $gt: now } }),
        User.countDocuments({ accountLockedUntil: { $gt: now } }),
        require("../models/AuditLog").countDocuments({ action: AUDIT_ACTIONS.LOGIN_SUCCESS, timestamp: { $gt: past24h } }),
        require("../models/AuditLog").countDocuments({ action: AUDIT_ACTIONS.LOGIN_FAILURE, timestamp: { $gt: past24h } }),
        User.countDocuments({ status: { $ne: ACCOUNT_STATUS.DELETED } })
    ]);

    return {
        activeSessions,
        lockedAccounts,
        recentLogins24h,
        failedLogins24h,
        totalUsers
    };
};

module.exports = {
    register,
    login,
    adminLogin,
    refreshSessionToken,
    logout,
    logoutAllSessions,
    resetPassword,
    changePassword,
    bootstrapAdmin,
    hasAdminAccount,
    sanitizeUser,
    getAuthMetrics,
    AuthError
};
