const Chat = require("../models/Chat");
const smartCacheHub = require("./cache/SmartCacheHub");

/**
 * Retrieves recent message turns and summary from Layer 8 Cache or MongoDB
 */
const getRecentMemory = async ({ userId, conversationId, limit = 6 }) => {
    if (!userId || !conversationId) {
        return [];
    }

    // 1. Layer 8 Memory Cache check
    const cachedRecent = smartCacheHub.l8.getRecentMemory(userId, conversationId, limit);
    if (cachedRecent && Array.isArray(cachedRecent) && cachedRecent.length > 0) {
        return cachedRecent;
    }

    const chat = await Chat.findOne({
        _id: conversationId,
        user: userId,
        status: "active"
    }).select("title summary messages");

    if (!chat || !chat.messages) {
        return [];
    }

    const recent = chat.messages.slice(-limit).map((message) => ({
        role: message.role,
        content: message.content,
        sources: message.sources || [],
        createdAt: message.createdAt
    }));

    // Populate Layer 8 Cache
    smartCacheHub.l8.setConversationContext(userId, conversationId, {
        title: chat.title || "New chat",
        summary: chat.summary || "",
        recentMessages: chat.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content,
            sources: m.sources || [],
            createdAt: m.createdAt
        })),
        totalMessages: chat.messages.length
    });

    return recent;
};

/**
 * Gets conversation context with separate summary and recent messages from Layer 8 Cache or MongoDB
 */
const getConversationContext = async ({ userId, conversationId, recentCount = 4 }) => {
    if (!userId || !conversationId) {
        return { summary: "", recentMessages: [] };
    }

    // 1. Layer 8 Memory Cache check
    const cachedContext = smartCacheHub.l8.getConversationContext(userId, conversationId);
    if (cachedContext) {
        return {
            title: cachedContext.title || "New chat",
            summary: cachedContext.summary || "",
            recentMessages: (cachedContext.recentMessages || []).slice(-recentCount),
            totalMessages: cachedContext.totalMessages || cachedContext.recentMessages?.length || 0
        };
    }

    const chat = await Chat.findOne({
        _id: conversationId,
        user: userId,
        status: "active"
    }).select("title summary messages");

    if (!chat || !chat.messages) {
        return { summary: "", recentMessages: [] };
    }

    const fullRecent = chat.messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        createdAt: m.createdAt
    }));

    const contextData = {
        title: chat.title || "New chat",
        summary: chat.summary || "",
        recentMessages: fullRecent,
        totalMessages: chat.messages.length
    };

    // Populate Layer 8 Cache
    smartCacheHub.l8.setConversationContext(userId, conversationId, contextData);

    return {
        title: contextData.title,
        summary: contextData.summary,
        recentMessages: fullRecent.slice(-recentCount),
        totalMessages: contextData.totalMessages
    };
};

module.exports = {
    getRecentMemory,
    getConversationContext
};
