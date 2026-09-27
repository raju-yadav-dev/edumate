const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { adminRateLimiter } = require("../middleware/rateLimiters");
const {
    getTraces,
    getTraceById,
    runQueryPlanner,
    runRagSandbox,
    runPromptSandbox,
    getAiLogs,
    getDebugBundle,
    replayTrace
} = require("../controllers/developerController");

const router = express.Router();

router.use(adminRateLimiter);
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/traces", getTraces);
router.get("/traces/:id", getTraceById);
router.post("/traces/replay", replayTrace);
router.post("/playground/query-planner", runQueryPlanner);
router.post("/playground/rag", runRagSandbox);
router.post("/playground/prompt", runPromptSandbox);
router.get("/logs", getAiLogs);
router.get("/debug-bundle/:traceId", getDebugBundle);

module.exports = router;
