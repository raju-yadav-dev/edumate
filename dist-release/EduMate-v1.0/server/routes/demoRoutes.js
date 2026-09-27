const express = require("express");
const router = express.Router();
const { DEMO_SHOWCASE_QUESTIONS } = require("../ai/evaluation/demoDataset");
const hackathonChecklistService = require("../services/hackathonChecklistService");

/**
 * GET /api/demo/questions
 * Returns 30 curated showcase demo questions
 */
router.get("/questions", (req, res) => {
    try {
        res.json({
            success: true,
            total: DEMO_SHOWCASE_QUESTIONS.length,
            questions: DEMO_SHOWCASE_QUESTIONS
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/demo/checklist
 * Runs readiness audit and returns checklist
 */
router.get("/checklist", async (req, res) => {
    try {
        const audit = await hackathonChecklistService.generateReadinessAudit();
        res.json({ success: true, audit });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/demo/certificate
 * Exports Markdown Hackathon Certificate
 */
router.get("/certificate", async (req, res) => {
    try {
        const cert = await hackathonChecklistService.generateMarkdownCertificate();
        res.setHeader("Content-Type", "text/markdown");
        res.setHeader("Content-Disposition", "attachment; filename=edumate-hackathon-readiness-certificate.md");
        res.send(cert);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
