const AI_CONSTANTS = require("../constants/aiConstants");

/**
 * Estimates the number of tokens in a string
 * @param {string} text
 * @returns {number}
 */
const countTokens = (text) => {
    if (!text || typeof text !== "string") {
        return 0;
    }
    // Estimated at ~4 characters per token
    return Math.ceil(text.length / AI_CONSTANTS.CHARS_PER_TOKEN);
};

/**
 * Trims message arrays from oldest to newest to fit token context window thresholds
 * @param {Array<Object>} messages - Array of { role, content }
 * @param {number} [maxTokens=AI_CONSTANTS.MAX_CONTEXT_TOKENS]
 * @returns {Array<Object>}
 */
const trimToContextLimit = (messages, maxTokens = AI_CONSTANTS.MAX_CONTEXT_TOKENS) => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    let accumulatedTokens = 0;
    const acceptedMessages = [];

    // Iterate backwards from the most recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const tokens = countTokens(msg.content || "");

        if (accumulatedTokens + tokens > maxTokens) {
            break;
        }

        acceptedMessages.unshift(msg);
        accumulatedTokens += tokens;
    }

    return acceptedMessages;
};

module.exports = {
    countTokens,
    trimToContextLimit
};
