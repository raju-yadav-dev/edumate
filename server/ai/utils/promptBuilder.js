/**
 * Generates prompt templates for different AI tasks to avoid hardcoding in services.
 */

/**
 * Builds the strict educational assistant system instructions
 * @returns {string}
 */
const getSystemPromptTemplate = () => {
    return [
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
        `Student Name: ${studentName}`,
        `Institution: ${institution}`,
        `Classified Intent: ${intent}`,
        `\n--- PRIOR CONVERSATION HISTORY ---\n${historyContext}`,
        `\n--- VERIFIED DOCUMENT CONTEXT ---\n${sourceContext}`,
        `\nUser Question: ${question}`
    ].join("\n");
};

/**
 * Prompt for generating dynamic follow-up questions
 */
const getSuggestedQuestionsPrompt = () => {
    return {
        system: "You are a university chatbot helper. Based on the previous query and response, generate 3 follow-up questions a student might ask next. Each question should be short (5-10 words) and specific to the response context. Return only the 3 questions, each on a new line. Do not add numbers, bullet points, introductory text, or markdown formatting.",
        formatUser: (query, response) => `Previous Query: ${query}\nPrevious Response: ${response}`
    };
};

/**
 * Prompt for summarizing older chat thread contexts to fit constraints
 */
const getSummarizationPrompt = () => {
    return {
        system: "You are an educational context summarizer. Condense the following chat history thread between a student and an AI assistant. Retain all key details, especially regarding programs, fee discussions, host rules, and student questions. Avoid introductory remarks, just return the concise summary.",
        formatUser: (historyText) => `Chat History to Summarize:\n${historyText}`
    };
};

module.exports = {
    getSystemPromptTemplate,
    formatUserPrompt,
    getSuggestedQuestionsPrompt,
    getSummarizationPrompt
};
