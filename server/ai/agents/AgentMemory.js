/**
 * Shared Agent Memory System — EduMate Mission 22
 * 
 * Supports:
 * - Shared conversation memory across all agents
 * - Entity state tracking (user department, current course, active session)
 * - Agent-specific scratchpads
 * - Memory window compression
 */

class AgentMemory {
    constructor() {
        this.sessionMemories = new Map(); // sessionId -> { turns: [], entities: {}, scratchpads: {} }
        this.globalSharedEntities = new Map();
    }

    getSession(sessionId = "default_session") {
        if (!this.sessionMemories.has(sessionId)) {
            this.sessionMemories.set(sessionId, {
                sessionId,
                turns: [],
                entities: {},
                scratchpads: {},
                lastAccessed: Date.now()
            });
        }
        const session = this.sessionMemories.get(sessionId);
        session.lastAccessed = Date.now();
        return session;
    }

    addTurn(sessionId, { userMessage, agentResponses, intent, participatingAgents }) {
        const session = this.getSession(sessionId);
        session.turns.push({
            timestamp: new Date().toISOString(),
            userMessage,
            agentResponses,
            intent,
            participatingAgents: participatingAgents || []
        });

        // Sliding window: keep last 20 turns
        if (session.turns.length > 20) {
            session.turns.shift();
        }
    }

    setEntity(sessionId, key, value) {
        const session = this.getSession(sessionId);
        session.entities[key] = value;
    }

    getEntity(sessionId, key) {
        const session = this.getSession(sessionId);
        return session.entities[key] || this.globalSharedEntities.get(key) || null;
    }

    setAgentScratchpad(sessionId, agentName, data) {
        const session = this.getSession(sessionId);
        session.scratchpads[agentName] = data;
    }

    getAgentScratchpad(sessionId, agentName) {
        const session = this.getSession(sessionId);
        return session.scratchpads[agentName] || null;
    }

    clearSession(sessionId) {
        this.sessionMemories.delete(sessionId);
    }

    getMemoryStats(sessionId = "default_session") {
        const session = this.getSession(sessionId);
        return {
            sessionId,
            turnsCount: session.turns.length,
            entitiesCount: Object.keys(session.entities).length,
            activeAgentsWithScratchpads: Object.keys(session.scratchpads),
            memorySizeBytes: JSON.stringify(session).length
        };
    }
}

module.exports = new AgentMemory();
