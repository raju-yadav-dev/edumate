const promptBuilder = require("../utils/promptBuilder");

/**
 * Service to orchestrate the generation of Gemini-grounded messages lists
 * @param {Object} params
 * @param {string} params.question - The user query
 * @param {string} params.intent - Intent classification label
 * @param {Array<Object>} params.retrievedChunks - Documents retrieved from vector database
 * @param {string} params.historyText - String-rendered conversation memory context
 * @param {Object} params.user - User details
 * @returns {Array<Object>} - Formatted message payload (system and user)
 */
const buildPromptMessages = ({
    question,
    intent,
    retrievedChunks,
    historyText,
    user
}) => {
    // 1. Format document sources into the prompt context block
    const sourceContext = retrievedChunks && retrievedChunks.length > 0
        ? retrievedChunks.map((chunk, index) => 
            `[Source #${index + 1}: ${chunk.metadata.originalName || "Document"}, Page: ${chunk.metadata.pageNumber || 1}, Category: ${chunk.metadata.category || "General"}]\nContent: ${chunk.content}`
          ).join("\n\n")
        : "No matching documents found in the database.";

    // 2. Fetch templates
    const systemPrompt = promptBuilder.getSystemPromptTemplate();
    
    const userPrompt = promptBuilder.formatUserPrompt({
        studentName: user?.fullName || "Guest",
        institution: user?.institution || "Not specified",
        intent: intent || "general",
        historyContext: historyText || "No prior conversation history.",
        sourceContext,
        question
    });

    return [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userPrompt
        }
    ];
};

module.exports = {
    buildPromptMessages
};
