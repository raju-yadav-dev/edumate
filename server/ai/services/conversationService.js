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
const getRecentMemory = async ({ userId, conversationId, maxTokens = 500, parentId = null }) => {
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

    // Backfill legacy IDs if needed
    chat.messages.forEach((msg, idx) => {
        if (!msg.id) {
            msg.id = `msg-legacy-${idx}-${chat._id}`;
            if (idx > 0 && !msg.parentId) {
                msg.parentId = chat.messages[idx - 1].id || `msg-legacy-${idx - 1}-${chat._id}`;
            }
        }
    });

    // Build map of messages by id
    const messageMap = {};
    chat.messages.forEach((m) => {
        if (m.id) messageMap[m.id] = m;
    });

    // Traverse backwards starting from parentId
    const branchMessages = [];
    let currentId = parentId;

    if (!currentId && chat.messages.length > 0) {
        currentId = chat.messages[chat.messages.length - 1].id;
    }

    const visited = new Set();
    while (currentId && messageMap[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        const msg = messageMap[currentId];
        branchMessages.unshift(msg);
        currentId = msg.parentId;
    }

    // Map DB messages to simple role/content pairs
    const rawHistory = branchMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || ""
    }));

    // Find the active topic and conversationContext from the branch messages (last non-empty topic)
    let activeTopic = "";
    let conversationContext = null;
    for (let i = branchMessages.length - 1; i >= 0; i--) {
        const msg = branchMessages[i];
        if (!activeTopic && msg.topic) {
            activeTopic = msg.topic;
        }
        if (!conversationContext && msg.role === "assistant" && msg.entities && msg.entities.conversationContext) {
            conversationContext = msg.entities.conversationContext;
        }
    }

    if (!conversationContext) {
        conversationContext = {
            currentTopic: null,
            currentEntity: null,
            currentIntent: null,
            mentionedDepartment: null,
            mentionedCollege: null,
            lastRelevantDocument: null,
            lastRetrievedSources: []
        };
    }

    // Trim history to stay within memory limits
    const recentOnly = rawHistory.slice(-4);
    const trimmed = tokenizer.trimToContextLimit(recentOnly, Math.min(maxTokens, Number(process.env.RAG_HISTORY_MAX_TOKENS) || 500));

    const historyText = trimmed
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

    return {
        historyText,
        rawHistory: trimmed,
        activeTopic,
        conversationContext
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

const saveMessageTurn = async ({ user, conversationId, question, response, intent, confidence, provider, responseTimeMs, userMessageId, assistantMessageId, parentId, topic, entities, retrievalContext }) => {
    const chat = await getOrCreateChat({
        user,
        conversationId,
        question
    });

    if (chat) {
        const uMsgId = userMessageId || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const aMsgId = assistantMessageId || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        let finalParentId = parentId;
        if (!finalParentId && chat.messages.length > 0) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            finalParentId = lastMsg.id || null;
        }

        // Backfill IDs for any old messages in this chat to prevent breaks
        chat.messages.forEach((msg, idx) => {
            if (!msg.id) {
                msg.id = `msg-legacy-${idx}-${chat._id}`;
                if (idx > 0 && !msg.parentId) {
                    msg.parentId = chat.messages[idx - 1].id || `msg-legacy-${idx-1}-${chat._id}`;
                }
            }
        });

        const finalIntent = Array.isArray(intent) ? intent.join(",") : String(intent || "unknown");

        chat.messages.push({
            id: uMsgId,
            parentId: finalParentId,
            role: "user",
            content: question,
            intent: finalIntent,
            confidence: confidence,
            provider: "user",
            topic: topic || "",
            entities: entities || {}
        });

        chat.messages.push({
            id: aMsgId,
            parentId: uMsgId,
            role: "assistant",
            content: (response && typeof response.answer === "string") ? response.answer : String(response || ""),
            intent: finalIntent,
            confidence: response.confidence === "high" ? 0.9 : response.confidence === "medium" ? 0.65 : 0.25,
            sources: response.sources || [],
            provider,
            responseTimeMs,
            mapData: response.mapData || null,
            topic: topic || "",
            entities: entities || {},
            retrievalContext: retrievalContext || null
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
