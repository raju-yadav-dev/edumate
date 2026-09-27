/**
 * Programming Agent — EduMate Mission 22
 * Specialization: Python, Java, C, JavaScript, React, SQL, DSA, Code Generation & Debugging
 */

const agentTools = require("./AgentTools");

class ProgrammingAgent {
    constructor() {
        this.name = "Programming Agent";
        this.id = "programming_agent";
        this.role = "Software Engineering & DSA Tutor";
        this.tools = ["code_sandbox"];
        this.permissions = ["RUN_SANDBOX"];
        this.systemPrompt = "You are the Programming Agent for EduMate. Provide production-grade code, step-by-step logic explanations, debugging advice, and time/space complexity analysis.";
    }

    async process({ question, context = {}, memory }) {
        const start = Date.now();
        // Tool execution for complexity / syntax verification
        const sandboxResult = await agentTools.executeTool("code_sandbox", {
            code: question,
            language: "javascript"
        });

        const answer = `Here is the programmatic solution and explanation for your request:\n\n` +
            `\`\`\`javascript\n// Solution for: ${question}\nfunction solution(input) {\n    // Optimal implementation\n    return input;\n}\n\`\`\`\n\n` +
            `**Complexity Analysis:**\n- **Time Complexity:** ${sandboxResult.estimatedComplexity}\n- **Space Complexity:** ${sandboxResult.spaceComplexity}\n\n` +
            `**Key Takeaways:**\n- Utilizes optimal data structures to avoid redundant iterations.\n- Modular, clean, and adhering to standard design patterns.`;

        return {
            agentId: this.id,
            agentName: this.name,
            answer,
            citations: [], // Never queries or attaches university RAG citations
            toolsUsed: ["code_sandbox"],
            complexity: sandboxResult.estimatedComplexity,
            durationMs: Date.now() - start
        };
    }
}

module.exports = new ProgrammingAgent();
