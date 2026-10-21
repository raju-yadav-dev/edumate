const mongoose = require("mongoose");
const Chat = require("../../models/Chat");
const tokenizer = require("../utils/tokenizer");
const promptBuilder = require("../utils/promptBuilder");
const llmService = require("./llmService");

const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
const LRUCache = require("../utils/lruCache");
const guestChatCache = new LRUCache(1000, 24 * 60 * 60 * 1000);

/**
 * Retrieves and trims recent message memory for a conversation thread
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.conversationId
 * @param {number} [params.maxTokens=1500]
 * @returns {Promise<Object>} - { historyText: string, rawHistory: Array }
 */
const getRecentMemory = async ({ userId, conversationId, maxTokens = 500, parentId = null }) => {
    if (!conversationId) {
        return {
            historyText: "",
            rawHistory: [],
            activeTopic: "",
            conversationContext: {
                currentTopic: null,
                currentEntity: null,
                currentIntent: null,
                mentionedDepartment: null,
                mentionedCollege: null,
                lastRelevantDocument: null,
                lastRetrievedSources: []
            },
            summary: ""
        };
    }

    let chat = null;
    if (userId && isValidObjectId(userId) && isValidObjectId(conversationId)) {
        try {
            chat = await Chat.findOne({
                _id: conversationId,
                user: userId,
                status: "active"
            });
        } catch (dbErr) {
            chat = null;
        }
    }

    if (!chat) {
        chat = guestChatCache.get(String(conversationId));
    }

    if (!chat || !chat.messages || chat.messages.length === 0) {
        return {
            historyText: "",
            rawHistory: [],
            activeTopic: "",
            conversationContext: {
                currentTopic: null,
                currentEntity: null,
                currentIntent: null,
                mentionedDepartment: null,
                mentionedCollege: null,
                lastRelevantDocument: null,
                lastRetrievedSources: []
            },
            summary: ""
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

    // If branch traversal returned empty but messages exist, fallback to chat.messages
    if (branchMessages.length === 0 && chat.messages.length > 0) {
        branchMessages.push(...chat.messages);
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

    // Trim history to stay within memory limits: Keep last 4–6 messages + auto-summarize older turns
    const recentWindowSize = 6;
    const recentOnly = rawHistory.slice(-recentWindowSize);
    let historyText = "";

    if (rawHistory.length > recentWindowSize) {
        let storedSummary = chat.summary || "";
        if (!storedSummary) {
            const olderMessages = rawHistory.slice(0, -recentWindowSize);
            storedSummary = olderMessages
                .map(m => `${m.role === "assistant" ? "AI" : "User"}: ${String(m.content || "").slice(0, 60)}`)
                .join(" | ")
                .slice(0, 200);
        }

        const recentDialogue = recentOnly
            .map((msg) => `${msg.role === "assistant" ? "Assistant" : "User"}: ${msg.content}`)
            .join("\n");

        historyText = `[Conversation Summary: ${storedSummary}]\n${recentDialogue}`;
    } else {
        historyText = recentOnly
            .map((msg) => `${msg.role === "assistant" ? "Assistant" : "User"}: ${msg.content}`)
            .join("\n");
    }

    const trimmed = tokenizer.trimToContextLimit(recentOnly, Math.min(maxTokens, Number(process.env.RAG_HISTORY_MAX_TOKENS) || 500));

    return {
        historyText,
        rawHistory: trimmed,
        activeTopic,
        conversationContext,
        summary: chat.summary || ""
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
    if (!user?._id || !isValidObjectId(user._id)) {
        return null;
    }

    if (conversationId && isValidObjectId(conversationId)) {
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
    let chat = null;
    if (user?._id && isValidObjectId(user._id)) {
        chat = await getOrCreateChat({
            user,
            conversationId,
            question
        });
    }

    const effectiveConvId = conversationId || (chat ? String(chat._id) : `guest_conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

    let targetChat = chat;
    if (!targetChat) {
        let guestChat = guestChatCache.get(effectiveConvId);
        if (!guestChat) {
            guestChat = {
                _id: effectiveConvId,
                title: question.slice(0, 80),
                messages: [],
                summary: ""
            };
        }
        targetChat = guestChat;
    }

    const uMsgId = userMessageId || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const aMsgId = assistantMessageId || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let finalParentId = parentId;
    if (!finalParentId && targetChat.messages.length > 0) {
        const lastMsg = targetChat.messages[targetChat.messages.length - 1];
        finalParentId = lastMsg.id || null;
    }

    // Backfill IDs for any old messages in this chat to prevent breaks
    targetChat.messages.forEach((msg, idx) => {
        if (!msg.id) {
            msg.id = `msg-legacy-${idx}-${effectiveConvId}`;
            if (idx > 0 && !msg.parentId) {
                msg.parentId = targetChat.messages[idx - 1].id || `msg-legacy-${idx-1}-${effectiveConvId}`;
            }
        }
    });

    const finalIntent = Array.isArray(intent) ? intent.join(",") : String(intent || "unknown");
    const sources = (response && Array.isArray(response.sources)) ? response.sources : [];

    targetChat.messages.push({
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

    targetChat.messages.push({
        id: aMsgId,
        parentId: uMsgId,
        role: "assistant",
        content: (response && typeof response.answer === "string") ? response.answer : String(response || ""),
        intent: finalIntent,
        confidence: response?.confidence === "high" ? 0.9 : response?.confidence === "medium" ? 0.65 : 0.25,
        sources,
        provider,
        responseTimeMs,
        mapData: response?.mapData || null,
        topic: topic || "",
        entities: entities || {},
        retrievalContext: retrievalContext || null
    });

    if (chat) {
        // Store aggregated retrieved sources on the Chat document
        if (sources.length > 0) {
            chat.retrievedSources = chat.retrievedSources || [];
            const existingKeys = new Set(chat.retrievedSources.map(s => `${s.title}-${s.reference}`));
            sources.forEach(src => {
                const title = src.documentTitle || src.title || "University Document";
                const reference = src.reference || "";
                const key = `${title}-${reference}`;
                if (!existingKeys.has(key)) {
                    existingKeys.add(key);
                    chat.retrievedSources.push({
                        type: src.type || "document",
                        title,
                        reference,
                        metadata: src.metadata || {}
                    });
                }
            });
        }

        // Set chat title from first query if still default
        if (chat.title === "New chat" && question) {
            chat.title = question.slice(0, 80);
        }

        // Auto-summarize older messages separately into chat.summary when message count grows
        if (chat.messages.length > 6) {
            const olderTurns = chat.messages.slice(0, -6);
            const summarySnippet = olderTurns
                .map(m => `${m.role === "user" ? "User asked about" : "Discussed"} ${String(m.content || "").slice(0, 40)}`)
                .slice(-6)
                .join("; ");
            chat.summary = summarySnippet.slice(0, 300);
        }

        chat.updatedBy = user._id;
        await chat.save();
    } else {
        if (targetChat.messages.length > 6) {
            const olderTurns = targetChat.messages.slice(0, -6);
            const summarySnippet = olderTurns
                .map(m => `${m.role === "user" ? "User asked about" : "Discussed"} ${String(m.content || "").slice(0, 40)}`)
                .slice(-6)
                .join("; ");
            targetChat.summary = summarySnippet.slice(0, 300);
        }
        guestChatCache.set(effectiveConvId, targetChat);
    }

    return targetChat;
};

module.exports = {
    getRecentMemory,
    summarizeHistory,
    getOrCreateChat,
    saveMessageTurn
};
