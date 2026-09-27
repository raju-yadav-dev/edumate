/**
 * Cache Routes — Production 10-Layer Smart Cache Endpoints
 * EduMate Mission 17
 */

const express = require("express");
const {
    getCacheStats,
    clearCache,
    warmCache,
    invalidateCache
} = require("../controllers/cacheController");

const router = express.Router();

router.get("/stats", getCacheStats);
router.post("/clear", clearCache);
router.post("/warm", warmCache);
router.post("/invalidate", invalidateCache);

module.exports = router;
