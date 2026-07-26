const llmService = require("./llmService");

/**
 * Rewrite the user query based on conversational context to be standalone
 * @param {Object} params
 * @param {string} params.question - The current user question
 * @param {string} params.historyText - Recent conversational history text
 * @returns {Promise<string>} - The rewritten standalone query
 */
const rewriteQuery = async ({ question, historyText }) => {
    if (!historyText || historyText.trim() === "") {
        return question;
    }

    const systemPrompt = `You are an AI assistant specialized in search query rewriting.
Given a conversation history and a user's follow-up question, rewrite the question into a single, standalone search query that contains all necessary context (like subjects, names, locations, referents, etc.) to be searched in a database.
Do not answer the question; only output the rewritten question.

Rules:
1. Preserve core meaning.
2. Resolve pronouns (it, they, he, she, there, them, that, etc.) to their context from the history.
3. Keep it brief and optimize for semantic keyword search.
4. If the question is already standalone and does not require context, output the original question exactly.

Output ONLY the rewritten search query. Do not add quotes, preambles, or markdown.

Conversation History:
${historyText}

Follow-up Question: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise query rewriter." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 100 });

        const cleaned = String(response).trim().replace(/^"|"$/g, ""); // strip quotes if generated
        if (cleaned) {
            return cleaned;
        }
    } catch (e) {
        console.error("Query Rewriting failed, using original query:", e.message);
    }

    return question;
};

module.exports = {
    rewriteQuery
};
