const express = require("express");
const router = express.Router();
const aiBenchmarkService = require("../services/aiBenchmarkService");
const performanceMonitoringService = require("../services/performanceMonitoringService");
const { getLlmConfig, getModelDiagnostics } = require("../config/llm");
const llamaProcessManager = require("../services/llamaProcessManager");

/**
 * Developer Mode Guard Middleware
 * Benchmarking is enabled when AI_DEBUG=true OR user has admin role
 */
const requireDevOrAdmin = (req, res, next) => {
    const config = getLlmConfig();
    const isAiDebug = config.aiDebug === true || process.env.AI_DEBUG === "true" || process.env.AI_DEBUG_MODE === "true";
    const isAdmin = req.user && ["admin", "superadmin"].includes(req.user.role);

    if (isAiDebug || isAdmin || process.env.NODE_ENV === "development" || process.env.DEV_MODE === "true") {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: "Access denied. AI Developer Benchmarking Dashboard is restricted to developers (AI_DEBUG=true)."
    });
};

/**
 * GET /api/benchmark/metrics
 * Returns live AI pipeline metrics, hardware stats, cache analytics, and SLA targets
 */
router.get("/metrics", requireDevOrAdmin, async (req, res) => {
    try {
        const diagnostics = await getModelDiagnostics();
        const hardware = aiBenchmarkService.getSystemHardwareMetrics();
        const cache = aiBenchmarkService.getCacheAnalytics();
        const monitoringSummary = performanceMonitoringService.getMetricsSummary();
        const processStatus = llamaProcessManager.getStatus();
        const targets = aiBenchmarkService.evaluateProductionTargets({
            queryPlanner: monitoringSummary.avgRetrievalLatencyMs ? Math.round(monitoringSummary.avgRetrievalLatencyMs * 0.15) : 0,
            qdrantSearch: monitoringSummary.avgRetrievalLatencyMs ? Math.round(monitoringSummary.avgRetrievalLatencyMs * 0.7) : 0,
            contextBuilder: monitoringSummary.avgRetrievalLatencyMs ? Math.round(monitoringSummary.avgRetrievalLatencyMs * 0.15) : 0,
            total: monitoringSummary.avgTotalLatencyMs || 0
        });

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            model: diagnostics,
            process: processStatus,
            hardware,
            cache,
            monitoring: monitoringSummary,
            targets,
            recentRequests: performanceMonitoringService.history.slice(-15).reverse()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/benchmark/run
 * Executes single benchmark scenario or full 4-tier suite
 */
router.post("/run", requireDevOrAdmin, async (req, res) => {
    try {
        const { scenarioId, iterations = 2 } = req.body || {};

        if (scenarioId) {
            const scenario = require("../services/aiBenchmarkService").BENCHMARK_SCENARIOS?.find(s => s.id === scenarioId);
            if (!scenario) {
                return res.status(400).json({ success: false, error: `Invalid scenario ID: ${scenarioId}` });
            }
            const result = await aiBenchmarkService.runSingleScenario(scenario, { iterations: Number(iterations) || 1 });
            return res.json({ success: true, result });
        }

        // Run full 4-tier suite
        const fullSuiteResult = await aiBenchmarkService.runFullBenchmarkSuite({ iterationsPerScenario: Number(iterations) || 2 });
        return res.json({ success: true, result: fullSuiteResult });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/benchmark/comparison
 * Returns comparative matrix for supported local GGUF models
 */
router.get("/comparison", requireDevOrAdmin, (req, res) => {
    try {
        const comparison = aiBenchmarkService.generateModelComparisonMatrix();
        res.json({ success: true, comparison });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/benchmark/history
 * Returns historical benchmark test suite runs
 */
router.get("/history", requireDevOrAdmin, (req, res) => {
    try {
        const history = aiBenchmarkService.getHistory();
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/benchmark/export
 * Exports complete benchmark report as JSON or Markdown
 */
router.get("/export", requireDevOrAdmin, async (req, res) => {
    try {
        const format = req.query.format || "json";
        const report = await aiBenchmarkService.exportBenchmarkReport();

        if (format === "markdown" || format === "md") {
            res.setHeader("Content-Type", "text/markdown");
            res.setHeader("Content-Disposition", "attachment; filename=edumate-ai-benchmark-report.md");
            return res.send(report.markdown);
        }

        res.json({ success: true, report: report.json, markdown: report.markdown });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
