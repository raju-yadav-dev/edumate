/**
 * Agent Orchestrator — EduMate Mission 22
 * 
 * Central coordinator that:
 * 1. Analyzes user intent
 * 2. Selects one or multiple specialized agents (parallel or sequential)
 * 3. Injects shared memory and context
 * 4. Executes agents and aggregates answers & citations
 */

const agentRegistry = require("./AgentRegistry");
const agentMemory = require("./AgentMemory");
const { inspectPromptSecurity } = require("../security/promptInjectionGuard");

class AgentOrchestrator {
    constructor() {
        this.registry = agentRegistry;
        this.memory = agentMemory;
    }

    /**
     * Determines which agent(s) should handle the user inquiry
     */
    routeAgents(question, userRole = "student") {
        const q = String(question || "").toLowerCase();

        // Security check
        const sec = inspectPromptSecurity(question);
        if (sec.isBlocked) {
            return {
                agents: [],
                isSecurityBlocked: true,
                fallbackMessage: sec.fallbackMessage
            };
        }

        const selectedAgents = [];

        // 1. Developer Agent (Admin restricted)
        if (q.includes("architecture") || q.includes("migration script") || q.includes("debug logs") || q.includes("developer mode")) {
            if (userRole === "admin" || userRole === "super_admin") {
                selectedAgents.push("developer_agent");
                return { agents: selectedAgents, mode: "SINGLE" };
            }
        }

        // 2. Scheduler Agent
        if (q.includes("timetable") || q.includes("exam date") || q.includes("assignment deadline") || q.includes("schedule") || q.includes("countdown")) {
            selectedAgents.push("scheduler_agent");
        }

        // 3. Analytics Agent
        if (q.includes("trending faqs") || q.includes("most searched") || q.includes("analytics") || q.includes("latency stats")) {
            selectedAgents.push("analytics_agent");
        }

        // 4. Document / Research Agent
        if (q.includes("compare regulations") || q.includes("synthesize documents") || q.includes("multi-document") || q.includes("research report")) {
            selectedAgents.push("research_agent");
        } else if (q.includes("summarize pdf") || q.includes("extract tables") || q.includes("document quiz") || q.includes("inside uploaded document")) {
            selectedAgents.push("document_agent");
        }

        // 5. Academic Tutor Agent
        if (q.includes("syllabus") || q.includes("flashcards") || q.includes("viva questions") || q.includes("study plan") || q.includes("mcq")) {
            selectedAgents.push("academic_agent");
        }

        // 6. Programming Agent
        const isProgramming = /\b(python|javascript|java|c\+\+|react|node|sql|dsa|algorithm|function|debug|code|class|oop|recursion|binary search|dijkstra)\b/i.test(q);
        if (isProgramming) {
            selectedAgents.push("programming_agent");
        }

        // 7. Knowledge Agent (University institutional queries)
        const isUniversity = /\b(admission|admissions|fees|tuition|hostel|scholarship|scholarships|faculty|hod|department|placement|placements|campus|building|notice|library|canteen|bus|brainware)\b/i.test(q);
        if (isUniversity || selectedAgents.length === 0) {
            if (!selectedAgents.includes("knowledge_agent")) {
                selectedAgents.push("knowledge_agent");
            }
        }

        return {
            agents: selectedAgents,
            mode: selectedAgents.length > 1 ? "PARALLEL" : "SINGLE",
            isSecurityBlocked: false
        };
    }

    /**
     * Master execution entry point
     */
    async execute({ question, sessionId = "default_session", userContext = {} }) {
        const start = Date.now();
        const routing = this.routeAgents(question, userContext.role || "student");

        if (routing.isSecurityBlocked) {
            return {
                answer: routing.fallbackMessage,
                participatingAgents: ["SecurityGuard"],
                citations: [],
                executionMode: "BLOCKED",
                latencyMs: Date.now() - start
            };
        }

        const agentIds = routing.agents;
        const agentPromises = agentIds.map(async (id) => {
            const agent = this.registry.getAgent(id);
            if (!agent) return null;

            const agentStart = Date.now();
            try {
                const result = await agent.process({
                    question,
                    context: userContext,
                    memory: this.memory
                });
                const duration = Date.now() - agentStart;
                this.registry.recordInvocation(id, duration);
                return result;
            } catch (err) {
                return {
                    agentId: id,
                    agentName: id,
                    answer: `Agent encountered an error: ${err.message}`,
                    citations: [],
                    toolsUsed: [],
                    durationMs: Date.now() - agentStart
                };
            }
        });

        const agentResults = (await Promise.all(agentPromises)).filter(Boolean);

        // Aggregate responses and citations
        const mergedCitations = [];
        const mergedTools = [];
        const answerSections = [];

        agentResults.forEach((res) => {
            if (res.answer) {
                if (agentResults.length > 1) {
                    answerSections.push(`#### 🤖 ${res.agentName}\n${res.answer}`);
                } else {
                    answerSections.push(res.answer);
                }
            }
            if (Array.isArray(res.citations)) {
                mergedCitations.push(...res.citations);
            }
            if (Array.isArray(res.toolsUsed)) {
                mergedTools.push(...res.toolsUsed);
            }
        });

        const finalAnswer = answerSections.join("\n\n---\n\n");

        // Record in shared memory
        this.memory.addTurn(sessionId, {
            userMessage: question,
            agentResponses: finalAnswer,
            intent: routing.mode,
            participatingAgents: agentIds
        });

        return {
            answer: finalAnswer,
            participatingAgents: agentResults.map(r => r.agentName),
            agentIds,
            executionMode: routing.mode,
            citations: mergedCitations,
            toolsUsed: Array.from(new Set(mergedTools)),
            latencyMs: Date.now() - start
        };
    }
}

module.exports = new AgentOrchestrator();
