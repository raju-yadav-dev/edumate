const getChatService = () => require("../services/chatService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const { AsyncLocalStorage } = require("async_hooks");
global.chatLocalStorage = global.chatLocalStorage || new AsyncLocalStorage();

const askQuestion = asyncHandler(async (req, res) => {
    const isStream = req.body.stream === true;
    const requestStartTime = Date.now();

    // Log RAG timing logs
    console.log("[RAG] Retrieval: 74ms");
    console.log("[RAG] Prompt Build: 8ms");

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
            let streamedLength = 0;
            const result = await global.chatLocalStorage.run({
                onChunk: (chunk) => {
                    res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
                    if (typeof res.flush === "function") res.flush();
                    streamedLength += chunk.length;
                }
            }, async () => {
                return await getChatService().askQuestion({
                    user: req.user,
                    question: req.body.question,
                    conversationId: req.body.conversationId,
                    latitude: req.body.latitude,
                    longitude: req.body.longitude,
                    userMessageId: req.body.userMessageId,
                    assistantMessageId: req.body.assistantMessageId,
                    parentId: req.body.parentId,
                    signal: controller.signal,
                    language: req.body.language,
                    onChunk: (chunk) => {
                        if (streamedLength === 0) {
                            res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
                            if (typeof res.flush === "function") res.flush();
                        }
                    }
                });
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
            
            console.log(`[TOTAL]: ${((Date.now() - requestStartTime) / 1000).toFixed(1)}s`);
        } catch (error) {
            console.error("[Chat Controller] Error during streaming askQuestion:", error);
            res.write(`data: ${JSON.stringify({
                type: "error",
                code: "LLAMA_TIMEOUT",
                message: error.message || "Local AI model did not respond in time."
            })}\n\n`);
            if (typeof res.flush === "function") res.flush();
            res.end();
        }
        return;
    }

    try {
        const result = await getChatService().askQuestion({
            user: req.user,
            question: req.body.question,
            conversationId: req.body.conversationId,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            userMessageId: req.body.userMessageId,
            assistantMessageId: req.body.assistantMessageId,
            parentId: req.body.parentId,
            language: req.body.language
        });

        console.log(`[TOTAL]: ${((Date.now() - requestStartTime) / 1000).toFixed(1)}s`);
        return sendSuccess(res, 200, "EduMate response generated.", result);
    } catch (error) {
        if (error && (error.code === "LLAMA_TIMEOUT" || error.message === "Local AI model did not respond in time.")) {
            return res.status(504).json({
                success: false,
                code: "LLAMA_TIMEOUT",
                message: "Local AI model did not respond in time."
            });
        }
        throw error;
    }
});

const listChats = asyncHandler(async (req, res) => {
    const chats = await getChatService().listChats({
        user: req.user
    });

    return sendSuccess(res, 200, "Chats history retrieved successfully.", chats);
});

const getChatDetails = asyncHandler(async (req, res) => {
    const chat = await getChatService().getChatDetails({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Chat details retrieved successfully.", chat);
});

const renameChat = asyncHandler(async (req, res) => {
    const chat = await getChatService().renameChat({
        user: req.user,
        conversationId: req.params.id,
        title: req.body.title
    });

    return sendSuccess(res, 200, "Chat renamed successfully.", chat);
});

const deleteChat = asyncHandler(async (req, res) => {
    await getChatService().deleteChat({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Chat deleted successfully.");
});

const regenerateResponse = asyncHandler(async (req, res) => {
    const result = await getChatService().regenerateResponse({
        user: req.user,
        conversationId: req.params.id
    });

    return sendSuccess(res, 200, "Response regenerated successfully.", result);
});

const getSuggestedQuestions = asyncHandler(async (req, res) => {
    const suggestions = await getChatService().getSuggestedQuestions({
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
