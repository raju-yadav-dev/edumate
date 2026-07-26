const Chat = require("../../models/Chat");
const tokenizer = require("../utils/tokenizer");
const promptBuilder = require("../utils/promptBuilder");
const gemini = require("../config/gemini");

/**
 * Retrieves and trims recent message memory for a conversation thread
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.conversationId
 * @param {number} [params.maxTokens=1500]
 * @returns {Promise<Object>} - { historyText: string, rawHistory: Array }
 */
const getRecentMemory = async ({ userId, conversationId, maxTokens = 1500 }) => {
    if (!userId || !conversationId) {
        return {
            historyText: "",
            rawHistory: []
        };
    }

    const chat = await Chat.findOne({
        _id: conversationId,
        user: userId,
        status: "active"
    });

    if (!chat || !chat.messages || chat.messages.length === 0) {
        return {
            historyText: "",
            rawHistory: []
        };
    }

    // Map DB messages to simple role/content pairs
    const rawHistory = chat.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || ""
    }));

    // Trim history to stay within memory limits
    const trimmed = tokenizer.trimToContextLimit(rawHistory, maxTokens);

    const historyText = trimmed
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

    return {
        historyText,
        rawHistory: trimmed
    };
};

/**
 * Condenses dialogue blocks into concise summary text
 * @param {string} historyText
 * @returns {Promise<string>}
 */
const summarizeHistory = async (historyText) => {
    if (!historyText || historyText.trim() === "") {
        return "";
    }

    const template = promptBuilder.getSummarizationPrompt();
    const messages = [
        { role: "system", content: template.system },
        { role: "user", content: template.formatUser(historyText) }
    ];

    try {
        return await gemini.generateCompletion(messages, { temperature: 0.1, maxOutputTokens: 300 });
    } catch (e) {
        console.error("Memory Summarization Error:", e.message);
        // Fallback: Return truncated raw text
        return historyText.slice(0, 500) + "...";
    }
};

module.exports = {
    getRecentMemory,
    summarizeHistory
};
