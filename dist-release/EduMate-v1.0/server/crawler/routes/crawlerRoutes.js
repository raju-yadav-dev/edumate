const express = require("express");
const authenticate = require("../../middleware/authMiddleware");
const authorizeRoles = require("../../middleware/roleMiddleware");
const crawlerController = require("../controllers/crawlerController");

const router = express.Router();

// Apply admin authentication to all crawler routes
router.use(authenticate);
router.use(authorizeRoles("admin", "super_admin"));

router.post("/start", crawlerController.startCrawl);
router.post("/recrawl-all", crawlerController.recrawlAllJobs);
router.post("/jobs/:jobId/cancel", crawlerController.cancelCrawl);
router.post("/jobs/:jobId/recrawl", crawlerController.recrawlCrawlJob);
router.delete("/jobs/:jobId", crawlerController.deleteCrawlJob);
router.get("/jobs", crawlerController.getCrawlJobs);
router.get("/jobs/:jobId", crawlerController.getCrawlJobDetails);

module.exports = router;
