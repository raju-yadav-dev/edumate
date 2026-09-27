const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
    getStorageStats,
    saveApiKeys,
    clearCache,
    backupDatabase,
    restoreBackup,
    deleteUnusedChunks,
    getActivityLogs,
    recordActivityLog,
    getSystemSettings,
    saveSystemSettings
} = require("../controllers/adminController");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/storage-stats", getStorageStats);
router.put("/settings/api-keys", saveApiKeys);
router.post("/cache/clear", clearCache);
router.post("/backup", backupDatabase);
router.post("/restore", restoreBackup);
router.post("/chunks/cleanup", deleteUnusedChunks);
router.get("/activity-logs", getActivityLogs);
router.post("/activity-logs", recordActivityLog);
router.get("/settings/:key", getSystemSettings);
router.put("/settings/:key", saveSystemSettings);

module.exports = router;
