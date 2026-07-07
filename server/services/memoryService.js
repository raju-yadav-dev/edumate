const Chat = require("../models/Chat");

const getRecentMemory = async ({ userId, conversationId, limit = 8 }) => {
    if (!userId || !conversationId) {
        return [];
    }

    const chat = await Chat.findOne({
        _id: conversationId,
        user: userId,
        status: "active"
    }).select("messages");

    if (!chat) {
        return [];
    }

    return chat.messages.slice(-limit).map((message) => ({
        role: message.role,
        content: message.content
    }));
};

module.exports = {
    getRecentMemory
};
