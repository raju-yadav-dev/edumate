const Chat = require("../../models/Chat");
const tokenizer = require("../utils/tokenizer");
const promptBuilder = require("../utils/promptBuilder");
const llmService = require("./llmService");

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
        return await llmService.generateCompletion(messages, { timeoutMs: 15000 });
    } catch (e) {
        console.error("Memory Summarization Error:", e.message);
        // Fallback: Return truncated raw text
        return historyText.slice(0, 500) + "...";
    }
};

const getOrCreateChat = async ({ user, conversationId, question }) => {
    if (!user?._id) {
        return null;
    }

    if (conversationId) {
        const existingChat = await Chat.findOne({
            _id: conversationId,
            user: user._id,
            status: "active"
        });
        if (existingChat) {
            return existingChat;
        }
    }

    return Chat.create({
        title: question.slice(0, 80),
        user: user._id,
        institution: user.institution || "",
        createdBy: user._id,
        updatedBy: user._id
    });
};

const saveMessageTurn = async ({ user, conversationId, question, response, intent, confidence, provider, responseTimeMs }) => {
    const chat = await getOrCreateChat({
        user,
        conversationId,
        question
    });

    if (chat) {
        chat.messages.push({
            role: "user",
            content: question,
            intent: intent,
            confidence: confidence,
            provider: "user"
        });

        chat.messages.push({
            role: "assistant",
            content: response.answer || response,
            intent: intent,
            confidence: response.confidence === "high" ? 0.9 : response.confidence === "medium" ? 0.65 : 0.25,
            sources: response.sources || [],
            provider,
            responseTimeMs,
            mapData: response.mapData || null
        });

        chat.updatedBy = user._id;
        await chat.save();
    }

    return chat;
};

module.exports = {
    getRecentMemory,
    summarizeHistory,
    getOrCreateChat,
    saveMessageTurn
};
