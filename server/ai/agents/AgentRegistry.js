/**
 * Agent Registry — EduMate Mission 22
 * 
 * Manages all 9 specialized agents:
 * 1. knowledge_agent
 * 2. programming_agent
 * 3. academic_agent
 * 4. document_agent
 * 5. research_agent
 * 6. voice_agent
 * 7. scheduler_agent
 * 8. analytics_agent
 * 9. developer_agent
 */

const knowledgeAgent = require("./KnowledgeAgent");
const programmingAgent = require("./ProgrammingAgent");
const academicAgent = require("./AcademicAgent");
const documentAgent = require("./DocumentAgent");
const {
    ResearchAgent,
    VoiceAgent,
    SchedulerAgent,
    AnalyticsAgent,
    DeveloperAgent
} = require("./SpecializedAgents");

class AgentRegistry {
    constructor() {
        this.agents = new Map();
        this.telemetry = new Map(); // agentId -> { invocations, totalLatencyMs, lastUsed }

        this._registerAgents();
    }

    _registerAgents() {
        const agentList = [
            knowledgeAgent,
            programmingAgent,
            academicAgent,
            documentAgent,
            ResearchAgent,
            VoiceAgent,
            SchedulerAgent,
            AnalyticsAgent,
            DeveloperAgent
        ];

        agentList.forEach(agent => {
            this.agents.set(agent.id, {
                instance: agent,
                id: agent.id,
                name: agent.name,
                role: agent.role,
                tools: agent.tools || [],
                permissions: agent.permissions || [],
                systemPrompt: agent.systemPrompt || "",
                isEnabled: true
            });

            this.telemetry.set(agent.id, {
                invocations: 0,
                totalLatencyMs: 0,
                lastUsed: null
            });
        });
    }

    getAgent(agentId) {
        const entry = this.agents.get(agentId);
        if (!entry) return null;
        if (!entry.isEnabled) return null; // Disabled agent
        return entry.instance;
    }

    listAgents() {
        return Array.from(this.agents.values()).map(entry => {
            const stats = this.telemetry.get(entry.id) || { invocations: 0, totalLatencyMs: 0 };
            const avgLatency = stats.invocations > 0 ? Math.round(stats.totalLatencyMs / stats.invocations) : 35;

            return {
                id: entry.id,
                name: entry.name,
                role: entry.role,
                tools: entry.tools,
                permissions: entry.permissions,
                isEnabled: entry.isEnabled,
                invocations: stats.invocations,
                avgLatencyMs: avgLatency,
                lastUsed: stats.lastUsed
            };
        });
    }

    setAgentStatus(agentId, isEnabled) {
        const entry = this.agents.get(agentId);
        if (entry) {
            entry.isEnabled = Boolean(isEnabled);
            return true;
        }
        return false;
    }

    recordInvocation(agentId, latencyMs) {
        const stats = this.telemetry.get(agentId);
        if (stats) {
            stats.invocations++;
            stats.totalLatencyMs += Number(latencyMs) || 0;
            stats.lastUsed = new Date().toISOString();
        }
    }
}

module.exports = new AgentRegistry();
