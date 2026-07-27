const chatService = require("../services/chatService"); // reload nodemon - ollama integration
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const askQuestion = asyncHandler(async (req, res) => {
    const result = await chatService.askQuestion({
        user: req.user,
        question: req.body.question,
        conversationId: req.body.conversationId
    });

    return sendSuccess(res, 200, "EduMate response generated.", result);
});

const listChats = asyncHandler(async (req, res) => {
    const chats = await chatService.listChats({
        user: req.user
    });

    return sendSuccess(res, 200, "Chats history retrieved successfully.", chats);
});

const getChatDetails = asyncHandler(async (req, res) => {
    const chat = await chatService.getChatDetails({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Chat details retrieved successfully.", chat);
});

const renameChat = asyncHandler(async (req, res) => {
    const chat = await chatService.renameChat({
        user: req.user,
        conversationId: req.params.id,
        title: req.body.title
    });

    return sendSuccess(res, 200, "Chat renamed successfully.", chat);
});

const deleteChat = asyncHandler(async (req, res) => {
    await chatService.deleteChat({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Chat deleted successfully.");
});

const regenerateResponse = asyncHandler(async (req, res) => {
    const result = await chatService.regenerateResponse({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Response regenerated successfully.", result);
});

const getSuggestedQuestions = asyncHandler(async (req, res) => {
    const suggestions = await chatService.getSuggestedQuestions({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Suggested questions retrieved successfully.", suggestions);
});

module.exports = {
    askQuestion,
    listChats,
    getChatDetails,
    renameChat,
    deleteChat,
    regenerateResponse,
    getSuggestedQuestions
};
