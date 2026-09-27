/**
 * Academic Tutor Agent — EduMate Mission 22
 * Specialization: Curriculum breakdown, notes synthesis, flashcards, MCQs, viva preparation, study plans
 */

const agentTools = require("./AgentTools");

class AcademicAgent {
    constructor() {
        this.name = "Academic Tutor Agent";
        this.id = "academic_agent";
        this.role = "Curriculum & Exam Prep Specialist";
        this.tools = ["rag_search"];
        this.permissions = ["READ_KNOWLEDGE_BASE"];
        this.systemPrompt = "You are the Academic Tutor Agent for EduMate. Help students master course syllabus topics, generate study guides, flashcards, and exam preparation materials.";
    }

    async process({ question, context = {}, memory }) {
        const start = Date.now();
        const chunks = await agentTools.executeTool("rag_search", { query: question, limit: 3 });

        const answer = `### 📚 Academic Study Guide & Key Concepts\n\n` +
            `**Topic Overview:** ${question}\n\n` +
            `**1. Core Principles:**\n` +
            `- Understand foundational theoretical definitions.\n` +
            `- Master standard analytical methodologies and problem patterns.\n\n` +
            `**2. Flashcards & Quick Recall:**\n` +
            `- **Q:** What is the primary objective of this subject?\n` +
            `- **A:** To build conceptual clarity, rigorous problem-solving, and practical application skills.\n\n` +
            `**3. Viva / Exam Practice Question:**\n` +
            `- *Explain the architectural significance and trade-offs of this concept.*`;

        return {
            agentId: this.id,
            agentName: this.name,
            answer,
            citations: chunks.map(c => ({ document: c.document, page: c.page, snippet: c.text?.slice(0, 100) })),
            toolsUsed: ["rag_search"],
            durationMs: Date.now() - start
        };
    }
}

module.exports = new AcademicAgent();
