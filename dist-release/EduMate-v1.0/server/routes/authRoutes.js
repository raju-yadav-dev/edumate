const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser,
    refreshToken,
    forgotPassword,
    getProfile,
    changePassword,
    logoutUser,
    logoutAllUser,
    getAdminStatus,
    bootstrapAdmin,
    adminLogin,
    getAuthMetrics
} = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
    loginLimiter,
    signupLimiter,
    refreshLimiter
} = require("../middleware/authRateLimiter");
const {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validatePasswordChange
} = require("../middleware/validationMiddleware");

router.post("/register", signupLimiter, validateRegister, registerUser);
router.post("/login", loginLimiter, validateLogin, loginUser);
router.post("/refresh", refreshLimiter, refreshToken);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.get("/admin/status", getAdminStatus);
router.post("/admin/bootstrap", signupLimiter, bootstrapAdmin);
router.post("/admin/login", loginLimiter, validateLogin, adminLogin);
router.post("/logout", optionalAuthLogout, logoutUser);
router.post("/logout-all", authenticate, logoutAllUser);
router.get("/profile", authenticate, getProfile);
router.patch("/change-password", authenticate, validatePasswordChange, changePassword);
router.get("/metrics", authenticate, authorizeRoles("admin", "super_admin"), getAuthMetrics);

// Helper for logout allowing both authenticated or bearer/body tokens
function optionalAuthLogout(req, res, next) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        return authenticate(req, res, next);
    }
    return next();
}

module.exports = router;
