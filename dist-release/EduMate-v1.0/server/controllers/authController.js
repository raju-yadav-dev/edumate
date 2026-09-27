const authService = require("../services/authService");
const { sendSuccess } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

const getSessionInfo = (req) => {
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

    let browser = "Browser";
    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";

    let os = "OS";
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

    return {
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress.split(",")[0].trim(),
        userAgent,
        browser,
        os,
        deviceName: `${os} (${browser})`
    };
};

const registerUser = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const authPayload = await authService.register(req.body, sessionInfo);

    return sendSuccess(
        res,
        201,
        "Registration successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken,
            refreshToken: authPayload.refreshToken,
            sessionId: authPayload.sessionId
        }
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const authPayload = await authService.login(req.body, sessionInfo);

    return sendSuccess(
        res,
        200,
        "Login successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken,
            refreshToken: authPayload.refreshToken,
            sessionId: authPayload.sessionId
        }
    );
});

const refreshToken = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const authPayload = await authService.refreshSessionToken(req.body, sessionInfo);

    return sendSuccess(
        res,
        200,
        "Token refreshed successfully.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken,
            refreshToken: authPayload.refreshToken,
            sessionId: authPayload.sessionId
        }
    );
});

const logoutUser = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const rawToken = req.body.refreshToken || "";
    const userId = req.user ? req.user._id : null;

    await authService.logout({ refreshToken: rawToken, userId }, sessionInfo);

    return sendSuccess(res, 200, "Logout successful.");
});

const logoutAllUser = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    await authService.logoutAllSessions(req.user._id, sessionInfo);

    return sendSuccess(res, 200, "All sessions revoked successfully.");
});

const forgotPassword = asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    return sendSuccess(res, 200, "Password updated successfully.");
});

const getProfile = asyncHandler(async (req, res) => {
    return sendSuccess(
        res,
        200,
        "Profile retrieved successfully.",
        authService.sanitizeUser(req.user)
    );
});

const changePassword = asyncHandler(async (req, res) => {
    await authService.changePassword({
        userId: req.user._id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword
    });

    return sendSuccess(res, 200, "Password changed successfully.");
});

const getAdminStatus = asyncHandler(async (req, res) => {
    const adminExists = await authService.hasAdminAccount();
    return sendSuccess(res, 200, "Admin status retrieved.", {
        adminExists,
        signupOpen: !adminExists
    });
});

const bootstrapAdmin = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const authPayload = await authService.bootstrapAdmin(req.body, sessionInfo);

    return sendSuccess(
        res,
        201,
        "Admin account created successfully.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken,
            refreshToken: authPayload.refreshToken,
            sessionId: authPayload.sessionId
        }
    );
});

const adminLogin = asyncHandler(async (req, res) => {
    const sessionInfo = getSessionInfo(req);
    const authPayload = await authService.adminLogin(req.body, sessionInfo);

    return sendSuccess(
        res,
        200,
        "Admin login successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken,
            refreshToken: authPayload.refreshToken,
            sessionId: authPayload.sessionId
        }
    );
});

const getAuthMetrics = asyncHandler(async (req, res) => {
    const metrics = await authService.getAuthMetrics();
    return sendSuccess(res, 200, "Authentication metrics retrieved.", metrics);
});

module.exports = {
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    logoutAllUser,
    forgotPassword,
    getProfile,
    changePassword,
    getAdminStatus,
    bootstrapAdmin,
    adminLogin,
    getAuthMetrics
};
