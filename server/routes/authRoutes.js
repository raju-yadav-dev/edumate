const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser,
    forgotPassword,
    getProfile,
    changePassword,
    logoutUser,
    getAdminStatus,
    bootstrapAdmin,
    adminLogin
} = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");
const {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validatePasswordChange
} = require("../middleware/validationMiddleware");

router.post("/register", validateRegister, registerUser);
router.post("/login", validateLogin, loginUser);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.get("/admin/status", getAdminStatus);
router.post("/admin/bootstrap", bootstrapAdmin);
router.post("/admin/login", validateLogin, adminLogin);
router.post("/logout", authenticate, logoutUser);
router.get("/profile", authenticate, getProfile);
router.patch("/change-password", authenticate, validatePasswordChange, changePassword);

module.exports = router;
