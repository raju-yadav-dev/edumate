const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { getStorageStats, saveApiKeys } = require("../controllers/adminController");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/storage-stats", getStorageStats);
router.put("/settings/api-keys", saveApiKeys);

module.exports = router;
