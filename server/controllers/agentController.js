/**
 * Agent Controller — EduMate Mission 22
 */

const agentRegistry = require("../ai/agents/AgentRegistry");
const agentOrchestrator = require("../ai/agents/AgentOrchestrator");
const agentMemory = require("../ai/agents/AgentMemory");
const agentTools = require("../ai/agents/AgentTools");
const { sendSuccess, sendError } = require("../utils/responseUtil");

const listAgents = (req, res) => {
    try {
        const agents = agentRegistry.listAgents();
        return sendSuccess(res, 200, "Agent ecosystem retrieved successfully.", { count: agents.length, agents });
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve agents: ${err.message}`);
    }
};

const toggleAgentStatus = (req, res) => {
    try {
        const { agentId, isEnabled } = req.body || {};
        if (!agentId) {
            return sendError(res, 400, "agentId is required.");
        }
        const updated = agentRegistry.setAgentStatus(agentId, isEnabled);
        if (!updated) {
            return sendError(res, 404, `Agent '${agentId}' not found.`);
        }
        return sendSuccess(res, 200, `Agent '${agentId}' status updated.`, { agentId, isEnabled });
    } catch (err) {
        return sendError(res, 500, `Failed to update agent status: ${err.message}`);
    }
};

const runAgentPlayground = async (req, res) => {
    try {
        const { question, agentId, sessionId = "admin_playground" } = req.body || {};
        if (!question) {
            return sendError(res, 400, "Question parameter is required.");
        }

        if (agentId) {
            // Direct single agent execution
            const agent = agentRegistry.getAgent(agentId);
            if (!agent) {
                return sendError(res, 404, `Agent '${agentId}' not found or disabled.`);
            }
            const result = await agent.process({
                question,
                context: { role: req.user?.role || "admin" },
                memory: agentMemory
            });
            return sendSuccess(res, 200, "Agent executed successfully.", result);
        }

        // Orchestrated multi-agent execution
        const result = await agentOrchestrator.execute({
            question,
            sessionId,
            userContext: { role: req.user?.role || "admin" }
        });
        return sendSuccess(res, 200, "Multi-agent orchestration executed successfully.", result);
    } catch (err) {
        return sendError(res, 500, `Agent execution failed: ${err.message}`);
    }
};

const listTools = (req, res) => {
    try {
        const tools = agentTools.listTools();
        return sendSuccess(res, 200, "Registered agent tools retrieved.", { count: tools.length, tools });
    } catch (err) {
        return sendError(res, 500, `Failed to list tools: ${err.message}`);
    }
};

const getMemoryStats = (req, res) => {
    try {
        const { sessionId = "default_session" } = req.query || {};
        const stats = agentMemory.getMemoryStats(sessionId);
        return sendSuccess(res, 200, "Shared agent memory stats retrieved.", stats);
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve memory stats: ${err.message}`);
    }
};

module.exports = {
    listAgents,
    toggleAgentStatus,
    runAgentPlayground,
    listTools,
    getMemoryStats
};
