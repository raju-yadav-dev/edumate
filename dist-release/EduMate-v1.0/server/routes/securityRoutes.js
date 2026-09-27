const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { adminRateLimiter } = require("../middleware/rateLimiters");
const {
    getSecurityMetrics,
    getAuditLogs,
    getActiveSessions,
    revokeSession
} = require("../controllers/securityController");

const router = express.Router();

router.use(adminRateLimiter);
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/metrics", getSecurityMetrics);
router.get("/audit-logs", getAuditLogs);
router.get("/sessions", getActiveSessions);
router.post("/sessions/revoke", revokeSession);

module.exports = router;
