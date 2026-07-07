const authService = require("../services/authService");
const { sendSuccess } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");

// ==============================
// Register User
// ==============================

const registerUser = asyncHandler(async (req, res) => {

    const authPayload = await authService.register(req.body);

    return sendSuccess(
        res,
        201,
        "Registration successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken
        }
    );

});

// ==============================
// Login User
// ==============================

const loginUser = asyncHandler(async (req, res) => {

    const authPayload = await authService.login(req.body);

    return sendSuccess(
        res,
        200,
        "Login successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken
        }
    );

});

// ==============================
// Reset Password
// ==============================

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

const logoutUser = asyncHandler(async (req, res) => {

    return sendSuccess(res, 200, "Logout successful.");

});

const getAdminStatus = asyncHandler(async (req, res) => {

    const adminExists = await authService.hasAdminAccount();

    return sendSuccess(res, 200, "Admin status retrieved.", {
        adminExists,
        signupOpen: !adminExists
    });

});

const bootstrapAdmin = asyncHandler(async (req, res) => {

    const authPayload = await authService.bootstrapAdmin(req.body);

    return sendSuccess(
        res,
        201,
        "Admin account created successfully.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken
        }
    );

});

const adminLogin = asyncHandler(async (req, res) => {

    const authPayload = await authService.adminLogin(req.body);

    return sendSuccess(
        res,
        200,
        "Admin login successful.",
        authPayload.user,
        {
            accessToken: authPayload.accessToken
        }
    );

});

module.exports = {

    registerUser,
    loginUser,
    forgotPassword,
    getProfile,
    changePassword,
    logoutUser,
    getAdminStatus,
    bootstrapAdmin,
    adminLogin

};
