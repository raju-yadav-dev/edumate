/**
 * Builds messages list for Gemini API with strict document grounding instructions.
 * @param {Object} params
 * @param {string} params.question - The user's query
 * @param {string} params.intent - Classified intent
 * @param {Object} params.retrievedContext - Vector search result chunks
 * @param {Array} params.memory - Conversation memory thread
 * @param {Object} params.user - User session details
 * @returns {Array<Object>} - Format ready for completion provider
 */
const buildMessages = ({ question, intent, retrievedContext, memory, user }) => {
    // Format retrieved document chunks with clear name & page boundaries
    const sourceContext = retrievedContext?.chunks?.length
        ? retrievedContext.chunks.map((chunk, index) => 
            `[Source #${index + 1}: ${chunk.metadata.originalName || "Document"}, Page: ${chunk.metadata.pageNumber || 1}, Category: ${chunk.metadata.category || "General"}]\nContent: ${chunk.content}`
          ).join("\n\n")
        : "No matching documents found in the database.";

    // Format conversation history
    const memoryContext = memory?.length
        ? memory.map((message) => `${message.role === "assistant" ? "assistant" : "user"}: ${message.content}`).join("\n")
        : "No prior conversation history.";

    const systemPrompt = [
        "You are EduMate, a helpful, strict university AI assistant.",
        "Your ONLY source of information is the 'Verified Document Context' provided below.",
        "",
        "CRITICAL INSTRUCTIONS FOR GROUNDING:",
        "1. Answer the user's question ONLY using the facts present in the 'Verified Document Context'.",
        "2. If the context does not contain the answer, or if there is no context provided, you MUST reply exactly with: 'I am sorry, but that information could not be found in the uploaded university documents.'",
        "3. NEVER use your own general training knowledge to answer university questions that are missing from the context.",
        "4. Do not fabricate, extrapolate, or guess details (such as dates, fees, rules, or contact details) that are not explicitly written in the context.",
        "",
        "CRITICAL INSTRUCTIONS FOR CITATIONS:",
        "5. For every fact, detail, or summary you provide, you must append an inline source citation in brackets, referencing the document name and page number. Example: 'The BCA program requires a minimum score of 60% [BCA_Admissions.pdf, Page 2].'",
        "6. Make sure citations are precise and only point to documents listed in the context.",
        "",
        "STYLE & FORMATTING:",
        "7. Keep answers structured, concise, and professional.",
        "8. Use markdown lists, bold text, and tables where appropriate to make information readable."
    ].join("\n");

    const userPrompt = [
        `Student Name: ${user?.fullName || "Guest"}`,
        `Institution: ${user?.institution || "Not specified"}`,
        `Classified Intent: ${intent || "general"}`,
        `\n--- PRIOR CONVERSATION HISTORY ---\n${memoryContext}`,
        `\n--- VERIFIED DOCUMENT CONTEXT ---\n${sourceContext}`,
        `\nUser Question: ${question}`
    ].join("\n");

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
    buildMessages
};
