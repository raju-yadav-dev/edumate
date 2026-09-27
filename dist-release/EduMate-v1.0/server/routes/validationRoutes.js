const express = require("express");
const router = express.Router();
const ragValidationEngine = require("../ai/evaluation/ragValidationEngine");
const { GROUND_TRUTH_DATASET, getAllCategories } = require("../ai/evaluation/groundTruthDataset");

/**
 * GET /api/validation/dataset
 * Returns catalog of ground truth test items and categories
 */
router.get("/dataset", (req, res) => {
    try {
        const categories = getAllCategories();
        res.json({
            success: true,
            totalQuestions: GROUND_TRUTH_DATASET.length,
            categories,
            dataset: GROUND_TRUTH_DATASET
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/validation/run
 * Executes validation on ground truth suite
 */
router.post("/run", async (req, res) => {
    try {
        const { category = "all", maxQuestions = null } = req.body || {};
        const report = await ragValidationEngine.runValidation({ category, maxQuestions });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/validation/export
 * Exports latest validation report in JSON or Markdown
 */
router.get("/export", (req, res) => {
    try {
        const format = (req.query.format || "json").toLowerCase();

        if (format === "markdown" || format === "md") {
            const md = ragValidationEngine.generateMarkdownReport();
            res.setHeader("Content-Type", "text/markdown");
            res.setHeader("Content-Disposition", "attachment; filename=edumate-rag-validation-report.md");
            return res.send(md);
        }

        res.json({
            success: true,
            report: ragValidationEngine.lastValidationResults
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
