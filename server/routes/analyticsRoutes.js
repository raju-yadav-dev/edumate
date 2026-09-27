const express = require("express");
const router = express.Router();
const knowledgeAnalyticsService = require("../services/knowledgeAnalyticsService");

/**
 * GET /api/analytics/overview
 * Returns complete knowledge base and AI system analytics
 */
router.get("/overview", async (req, res) => {
    try {
        const analytics = await knowledgeAnalyticsService.getCompleteAnalytics();
        res.json({ success: true, data: analytics });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/analytics/export
 * Exports analytics in CSV or JSON format
 */
router.get("/export", async (req, res) => {
    try {
        const format = (req.query.format || "json").toLowerCase();

        if (format === "csv") {
            const csv = await knowledgeAnalyticsService.exportCsvReport();
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=edumate-analytics-report.csv");
            return res.send(csv);
        }

        const analytics = await knowledgeAnalyticsService.getCompleteAnalytics();
        res.json({ success: true, report: analytics });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
