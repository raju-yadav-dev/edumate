const chatService = require("../services/chatService"); // reload nodemon - ollama integration
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const askQuestion = asyncHandler(async (req, res) => {
    const isStream = req.body.stream === true;

    if (isStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const controller = new AbortController();
        res.on("close", () => {
            if (!res.writableEnded) {
                console.log("[Chat Controller] Response closed. Aborting streaming request...");
                controller.abort();
            }
        });

        try {
            const result = await chatService.askQuestion({
                user: req.user,
                question: req.body.question,
                conversationId: req.body.conversationId,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                userMessageId: req.body.userMessageId,
                assistantMessageId: req.body.assistantMessageId,
                parentId: req.body.parentId,
                signal: controller.signal,
                onChunk: (chunk) => {
                    res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
                    if (typeof res.flush === "function") res.flush();
                }
            });

            res.write(`data: ${JSON.stringify({
                type: "done",
                message: result.message,
                sources: result.sources || [],
                confidence: result.confidence || "medium",
                suggestions: result.suggestions || [],
                conversationId: result.conversationId,
                mapData: result.mapData || null,
                requiresLocationPermission: result.requiresLocationPermission || false
            })}\n\n`);
            if (typeof res.flush === "function") res.flush();
            res.end();
        } catch (error) {
            console.error("[Chat Controller] Error during streaming askQuestion:", error);
            res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
            if (typeof res.flush === "function") res.flush();
            res.end();
        }
        return;
    }

    const result = await chatService.askQuestion({
        user: req.user,
        question: req.body.question,
        conversationId: req.body.conversationId,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        userMessageId: req.body.userMessageId,
        assistantMessageId: req.body.assistantMessageId,
        parentId: req.body.parentId
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
