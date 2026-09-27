/**
 * Developer Controller — EduMate Mission 21
 */

const developerModeService = require("../services/developerModeService");
const smartCacheHub = require("../services/cache/SmartCacheHub");
const { sendSuccess, sendError } = require("../utils/responseUtil");

const getTraces = (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const traces = developerModeService.getTraces(limit);
        return sendSuccess(res, 200, "Developer traces retrieved successfully.", { count: traces.length, traces });
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve traces: ${err.message}`);
    }
};

const getTraceById = (req, res) => {
    try {
        const { id } = req.params;
        const trace = developerModeService.getTraceById(id);
        if (!trace) {
            return sendError(res, 404, `Trace '${id}' not found.`);
        }
        return sendSuccess(res, 200, "Trace details retrieved successfully.", trace);
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve trace details: ${err.message}`);
    }
};

const runQueryPlanner = (req, res) => {
    try {
        const { question } = req.body || {};
        if (!question) {
            return sendError(res, 400, "Question parameter is required.");
        }
        const result = developerModeService.runQueryPlannerPlayground(question);
        return sendSuccess(res, 200, "Query plan generated successfully.", result);
    } catch (err) {
        return sendError(res, 500, `Query planner execution failed: ${err.message}`);
    }
};

const runRagSandbox = async (req, res) => {
    try {
        const { query, topK = 5, category = null, hybrid = true, minScore = 0.5 } = req.body || {};
        if (!query) {
            return sendError(res, 400, "Query string is required.");
        }
        const result = await developerModeService.runRagPlayground({ query, topK, category, hybrid, minScore });
        return sendSuccess(res, 200, "RAG retrieval simulated successfully.", result);
    } catch (err) {
        return sendError(res, 500, `RAG sandbox execution failed: ${err.message}`);
    }
};

const runPromptSandbox = (req, res) => {
    try {
        const { question, customSystemPrompt, contextDocs } = req.body || {};
        if (!question) {
            return sendError(res, 400, "Question parameter is required.");
        }
        const result = developerModeService.runPromptPlayground({ question, customSystemPrompt, contextDocs });
        return sendSuccess(res, 200, "Prompt constructed successfully.", result);
    } catch (err) {
        return sendError(res, 500, `Prompt sandbox execution failed: ${err.message}`);
    }
};

const getAiLogs = (req, res) => {
    try {
        const { level, category, search, limit = 100 } = req.query || {};
        const logs = developerModeService.getLogs({ level, category, search, limit });
        return sendSuccess(res, 200, "AI execution logs retrieved.", { count: logs.length, logs });
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve AI logs: ${err.message}`);
    }
};

const getDebugBundle = (req, res) => {
    try {
        const { traceId } = req.params;
        const bundle = developerModeService.getDebugBundle(traceId);
        return sendSuccess(res, 200, "Debug bundle generated.", bundle);
    } catch (err) {
        return sendError(res, 500, `Failed to generate debug bundle: ${err.message}`);
    }
};

const replayTrace = async (req, res) => {
    try {
        const { traceId } = req.body || {};
        const trace = developerModeService.getTraceById(traceId);
        if (!trace) {
            return sendError(res, 404, `Trace '${traceId}' not found.`);
        }

        // Simulate fast replay through query planner and sandbox
        const planResult = developerModeService.runQueryPlannerPlayground(trace.query);
        const ragResult = await developerModeService.runRagPlayground({ query: trace.query, topK: 5 });

        const replayedTrace = developerModeService.recordTrace({
            query: trace.query,
            normalizedQuery: planResult.question,
            intent: planResult.plan.intent,
            routingMode: planResult.plan.routingMode,
            category: planResult.plan.category,
            totalLatencyMs: planResult.durationMs + ragResult.retrievalLatencyMs + 45,
            status: "SUCCESS",
            timeline: trace.timeline,
            prompts: trace.prompts,
            retrieval: { chunks: ragResult.chunks },
            response: trace.response
        });

        return sendSuccess(res, 200, "Trace replayed successfully.", replayedTrace);
    } catch (err) {
        return sendError(res, 500, `Failed to replay trace: ${err.message}`);
    }
};

module.exports = {
    getTraces,
    getTraceById,
    runQueryPlanner,
    runRagSandbox,
    runPromptSandbox,
    getAiLogs,
    getDebugBundle,
    replayTrace
};
