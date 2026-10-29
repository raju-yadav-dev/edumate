/**
 * Programming Agent — Real LLM-Powered Code & DSA Tutor
 */

const llmService = require("../services/llmService");

class ProgrammingAgent {
    constructor() {
        this.name = "Programming Agent";
        this.id = "programming_agent";
        this.role = "Software Engineering & DSA Tutor";
        this.tools = ["code_sandbox"];
        this.permissions = ["RUN_SANDBOX"];
        this.systemPrompt = "You are the Programming & Software Engineering Agent for EduMate. Provide production-grade code, step-by-step logic explanations, debugging advice, and time/space complexity analysis in markdown.";
    }

    async process({ question }) {
        const start = Date.now();
        try {
            const answer = await llmService.generateCompletion([
                { role: "system", content: this.systemPrompt },
                { role: "user", content: question }
            ]);

            return {
                agentId: this.id,
                agentName: this.name,
                answer: typeof answer === "string" ? answer : JSON.stringify(answer),
                citations: [],
                toolsUsed: ["llm_code_generator"],
                durationMs: Date.now() - start
            };
        } catch (err) {
            return {
                agentId: this.id,
                agentName: this.name,
                answer: `Programming assistant unavailable: ${err.message}`,
                citations: [],
                toolsUsed: [],
                durationMs: Date.now() - start
            };
        }
    }
}

module.exports = new ProgrammingAgent();
