const corePromptService = require("../../services/promptService");

/**
 * Service to orchestrate the generation of Gemini-grounded messages lists
 * @param {Object} params
 * @param {string} params.question - The user query
 * @param {string} params.intent - Intent classification label
 * @param {Array<Object>} params.retrievedChunks - Documents retrieved from vector database
 * @param {Array<Object>} params.webResults - Web search results
 * @param {string} params.historyText - String-rendered conversation memory context
 * @param {Object} params.user - User details
 * @param {string} params.questionType - The classified question type
 * @returns {Array<Object>} - Formatted message payload (system and user)
 */
const buildPromptMessages = ({
    question,
    intent,
    retrievedChunks,
    universitySiteResults = [],
    webResults = [],
    historyText,
    user,
    questionType
}) => {
    const memory = historyText ? [{ role: "user", content: "Conversation History summary: " + historyText }] : [];

    return corePromptService.buildMessages({
        question,
        intent,
        retrievedChunks,
        universitySiteResults,
        webResults,
        memory,
        user,
        questionType
    });
};

module.exports = {
    buildPromptMessages
};
