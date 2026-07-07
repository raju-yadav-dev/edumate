const chatService = require("../services/chatService");
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

module.exports = {
    askQuestion
};
