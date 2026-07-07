const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { saveApiKeys } = require("../controllers/adminController");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.put("/settings/api-keys", saveApiKeys);

module.exports = router;
