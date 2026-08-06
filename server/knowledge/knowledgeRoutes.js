const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const knowledgeController = require("./knowledgeController");

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.get("/sources", knowledgeController.getSources);
router.put("/sources/priorities", knowledgeController.updatePriorities);
router.put("/sources/:id", knowledgeController.updateSource);
router.post("/sources/websites", knowledgeController.addWebsiteUrl);
router.delete("/sources/:id", knowledgeController.deleteSource);

module.exports = router;
