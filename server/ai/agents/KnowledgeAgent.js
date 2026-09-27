/**
 * Knowledge Agent — EduMate Mission 22
 * Specialization: University Admissions, Fees, Faculty, Hostel, Scholarships, Notices, Departments
 */

const agentTools = require("./AgentTools");

class KnowledgeAgent {
    constructor() {
        this.name = "Knowledge Agent";
        this.id = "knowledge_agent";
        this.role = "University Grounded Specialist";
        this.tools = ["rag_search"];
        this.permissions = ["READ_KNOWLEDGE_BASE"];
        this.systemPrompt = "You are the Knowledge Agent for EduMate. Answer questions regarding university policies, admissions, fees, faculty, and campus procedures grounded strictly in verified institutional documents with precise citations.";
    }

    async process({ question, context = {}, memory }) {
        const start = Date.now();
        // 1. Tool Call: RAG Search
        const chunks = await agentTools.executeTool("rag_search", {
            query: question,
            category: context.category || null,
            limit: 5
        });

        const hasChunks = chunks && chunks.length > 0;
        const citations = hasChunks
            ? chunks.map(c => ({
                  document: c.document,
                  page: c.page,
                  snippet: c.text ? c.text.slice(0, 120) : "",
                  confidence: c.score || 0.95
              }))
            : [];

        let answer = "";
        if (hasChunks) {
            const topChunk = chunks[0];
            answer = `Based on official university records in **${topChunk.document}** (Page ${topChunk.page}):\n\n${topChunk.text}`;
        } else {
            answer = "I searched the university knowledge base, but could not find matching institutional records for your specific inquiry.";
        }

        return {
            agentId: this.id,
            agentName: this.name,
            answer,
            citations,
            toolsUsed: ["rag_search"],
            retrievedChunksCount: chunks.length,
            durationMs: Date.now() - start
        };
    }
}

module.exports = new KnowledgeAgent();
