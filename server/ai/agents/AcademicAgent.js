/**
 * Academic Tutor Agent — Real LLM-Powered Study & Exam Prep Specialist
 */

const llmService = require("../services/llmService");
const agentTools = require("./AgentTools");

class AcademicAgent {
    constructor() {
        this.name = "Academic Tutor Agent";
        this.id = "academic_agent";
        this.role = "Curriculum & Exam Prep Specialist";
        this.tools = ["rag_search"];
        this.permissions = ["READ_KNOWLEDGE_BASE"];
        this.systemPrompt = "You are the Academic Tutor Agent for EduMate. Help students master course syllabus topics, generate study guides, flashcards, and exam preparation materials based on curriculum and university standards.";
    }

    async process({ question }) {
        const start = Date.now();
        try {
            const chunks = await agentTools.executeTool("rag_search", { query: question, limit: 3 }).catch(() => []);
            const contextText = Array.isArray(chunks) && chunks.length > 0 
                ? chunks.map(c => `[${c.document} - Page ${c.page}]: ${c.text}`).join("\n\n")
                : "";

            const userPrompt = contextText
                ? `Institutional Knowledge Context:\n${contextText}\n\nStudent Academic Question: ${question}`
                : question;

            const answer = await llmService.generateCompletion([
                { role: "system", content: this.systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            return {
                agentId: this.id,
                agentName: this.name,
                answer: typeof answer === "string" ? answer : JSON.stringify(answer),
                citations: (chunks || []).map(c => ({
                    document: c.document,
                    page: c.page,
                    snippet: c.text ? c.text.slice(0, 100) : ""
                })),
                toolsUsed: ["rag_search", "llm_tutor"],
                durationMs: Date.now() - start
            };
        } catch (err) {
            return {
                agentId: this.id,
                agentName: this.name,
                answer: `Academic tutor encountered an error: ${err.message}`,
                citations: [],
                toolsUsed: [],
                durationMs: Date.now() - start
            };
        }
    }
}

module.exports = new AcademicAgent();
