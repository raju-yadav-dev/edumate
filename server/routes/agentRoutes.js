const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { adminRateLimiter } = require("../middleware/rateLimiters");
const {
    listAgents,
    toggleAgentStatus,
    runAgentPlayground,
    listTools,
    getMemoryStats
} = require("../controllers/agentController");

const router = express.Router();

router.use(adminRateLimiter);
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/list", listAgents);
router.post("/toggle", toggleAgentStatus);
router.post("/playground", runAgentPlayground);
router.get("/tools", listTools);
router.get("/memory", getMemoryStats);

module.exports = router;
