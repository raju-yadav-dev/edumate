/**
 * EduMate Prompt Builder — Ultra-Optimized Sub-250 Token System Prompt
 * 
 * Rules:
 * 1. Strictly sub-250 tokens system prompt for sub-second TTFT.
 * 2. Grounded entirely on Verified Document Context.
 * 3. Thinking mode explicitly prohibited (never output <think> tokens).
 * 4. Markdown tables and structured bullet points for clean readability.
 */

/**
 * Builds concise, strict educational assistant system instructions (sub-250 tokens)
 * @returns {string}
 */
const getSystemPromptTemplate = () => {
    return [
        "You are EduMate, a strict, factual university AI assistant.",
        "Your ONLY source of information is the 'Verified Document Context' below.",
        "",
        "RULES:",
        "1. Answer ONLY using facts from 'Verified Document Context'. Do not assume, guess, or use outside knowledge.",
        "2. If the context does not contain the answer, reply exactly: 'I couldn't find verified information for that request.'",
        "3. Do NOT output thinking tokens, reasoning chains, or <think> tags. Provide ONLY the final answer.",
        "4. Do NOT mention internal systems (vector databases, Qdrant, chunks, prompt templates, embeddings).",
        "5. Do NOT provide document download links or mention file names unless the user explicitly requests a document.",
        "6. Format fees, dates, comparisons, and structured records into clean markdown tables or crisp bullet points."
    ].join("\n");
};

/**
 * Format RAG User prompt
 */
const formatUserPrompt = ({
    studentName = "Guest",
    institution = "Not specified",
    intent = "general",
    historyContext = "No prior conversation history.",
    sourceContext = "No matching documents found in the database.",
    question
}) => {
    return [
        `Student: ${studentName} | Institution: ${institution} | Intent: ${intent}`,
        `\n--- PRIOR CONVERSATION HISTORY ---\n${historyContext}`,
        `\n--- VERIFIED DOCUMENT CONTEXT ---\n${sourceContext}`,
        `\nQuestion: ${question}`
    ].join("\n");
};

/**
 * Prompt for generating dynamic follow-up questions
 */
const getSuggestedQuestionsPrompt = () => {
    return {
        system: "You are a university chatbot helper. Generate 3 short follow-up questions (5-10 words) based on the context. Return only 3 lines without numbers, bullets, or thinking tokens.",
        formatUser: (query, response) => `Previous Query: ${query}\nPrevious Response: ${response}`
    };
};

/**
 * Prompt for summarizing older chat thread contexts to fit constraints
 */
const getSummarizationPrompt = () => {
    return {
        system: "You are an educational context summarizer. Condense the chat history into a concise summary of key facts and decisions without introductory remarks or thinking tags.",
        formatUser: (historyText) => `Chat History to Summarize:\n${historyText}`
    };
};

module.exports = {
    getSystemPromptTemplate,
    formatUserPrompt,
    getSuggestedQuestionsPrompt,
    getSummarizationPrompt
};
