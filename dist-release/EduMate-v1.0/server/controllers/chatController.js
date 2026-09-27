const getChatService = () => require("../services/chatService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const { AsyncLocalStorage } = require("async_hooks");
global.chatLocalStorage = global.chatLocalStorage || new AsyncLocalStorage();

// Active stream registry to gracefully abort previous generation when a user sends a new message
const activeStreams = new Map();

const getStreamKey = (req) => {
    if (req.user?._id) return `user_${String(req.user._id)}`;
    if (req.body.conversationId) return `conv_${String(req.body.conversationId)}`;
    return `session_${req.ip || "guest"}`;
};

const registerActiveStream = (key, controller, res) => {
    if (activeStreams.has(key)) {
        const prev = activeStreams.get(key);
        try {
            console.log(`[Chat Controller] Gracefully aborting previous active stream for ${key}`);
            prev.controller.abort();
            if (!prev.res.writableEnded) {
                prev.res.write(`data: ${JSON.stringify({
                    type: "cancelled",
                    event: "cancelled",
                    status: "Request cancelled by new message",
                    progress: 100,
                    timestamp: new Date().toISOString()
                })}\n\n`);
                if (typeof prev.res.flush === "function") prev.res.flush();
                prev.res.end();
            }
        } catch (e) {
            console.warn("[Chat Controller] Error closing previous stream:", e.message);
        }
        activeStreams.delete(key);
    }
    activeStreams.set(key, { controller, res });
};

const unregisterActiveStream = (key, controller) => {
    const current = activeStreams.get(key);
    if (current && current.controller === controller) {
        activeStreams.delete(key);
    }
};

const askQuestion = asyncHandler(async (req, res) => {
    const isStream = req.body.stream === true;
    const requestStartTime = Date.now();

    if (isStream) {
        // 1. Open SSE Connection Immediately & Flush Headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (Nginx)
        res.flushHeaders();

        const streamKey = getStreamKey(req);
        const controller = new AbortController();
        registerActiveStream(streamKey, controller, res);

        const emitSseEvent = (data) => {
            if (res.writableEnded) return;
            const payload = {
                timestamp: new Date().toISOString(),
                ...data
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
            if (typeof res.flush === "function") res.flush();
        };

        // Emit Initial Event 1: connected immediately
        emitSseEvent({
            type: "status",
            event: "connected",
            status: "Connected to EduMate streaming server",
            stage: "connected",
            progress: 5
        });

        res.on("close", () => {
            unregisterActiveStream(streamKey, controller);
            if (!res.writableEnded) {
                console.log(`[Chat Controller] Response closed by client. Aborting streaming request for ${streamKey}...`);
                controller.abort();
            }
        });

        try {
            let streamedLength = 0;
            const onStatus = (status, stage, extra = {}) => {
                let progress = 25;
                if (stage === "searching_knowledge_base" || stage === "retrieval") progress = 25;
                else if (stage === "retrieval_completed") progress = 50;
                else if (stage === "building_context" || stage === "context") progress = 65;
                else if (stage === "generating_response" || stage === "generation") progress = 80;
                
                if (extra.progress !== undefined) progress = extra.progress;

                emitSseEvent({
                    type: "status",
                    event: stage,
                    status,
                    stage,
                    progress,
                    ...extra
                });
            };

            const questionText = (req.body.question || req.body.message || "").trim();
            const result = await global.chatLocalStorage.run({
                signal: controller.signal,
                onChunk: (chunk) => {
                    emitSseEvent({
                        type: "chunk",
                        event: "stream_token",
                        content: chunk,
                        progress: 90
                    });
                    streamedLength += chunk.length;
                },
                onStatus
            }, async () => {
                return await getChatService().askQuestion({
                    user: req.user,
                    question: questionText,
                    conversationId: req.body.conversationId,
                    latitude: req.body.latitude,
                    longitude: req.body.longitude,
                    userMessageId: req.body.userMessageId,
                    assistantMessageId: req.body.assistantMessageId,
                    parentId: req.body.parentId,
                    signal: controller.signal,
                    language: req.body.language,
                    onStatus,
                    onChunk: (chunk) => {
                        if (streamedLength === 0) {
                            emitSseEvent({
                                type: "chunk",
                                event: "stream_token",
                                content: chunk,
                                progress: 90
                            });
                        }
                    }
                });
            });

            // Emit Event 7: completed / done
            emitSseEvent({
                type: "done",
                event: "completed",
                status: "Response generated successfully",
                stage: "completed",
                progress: 100,
                message: result.message,
                sources: result.sources || [],
                confidence: result.confidence || "medium",
                suggestions: result.suggestions || [],
                conversationId: result.conversationId,
                mapData: result.mapData || null,
                requiresLocationPermission: result.requiresLocationPermission || false
            });

            unregisterActiveStream(streamKey, controller);
            res.end();
            console.log(`[TOTAL STREAMING TIME]: ${((Date.now() - requestStartTime) / 1000).toFixed(2)}s`);
        } catch (error) {
            unregisterActiveStream(streamKey, controller);
            if (controller.signal.aborted || error?.code === "REQUEST_ABORTED") {
                console.log("[Chat Controller] Streaming request cleanly aborted.");
                if (!res.writableEnded) res.end();
                return;
            }

            console.error("[Chat Controller] Error during streaming askQuestion:", error);
            
            let code = error?.code || "CHAT_EXECUTION_ERROR";
            let message = error?.message || "An error occurred while generating the response.";

            if (error?.code === "LLM_UNAVAILABLE" || error?.code === "LLAMACPP_UNAVAILABLE" || error?.code === "ECONNREFUSED" || error?.message?.includes("Local AI model unavailable")) {
                code = "LLM_UNAVAILABLE";
                message = "Local AI model is currently unavailable.";
            } else if (error?.code === "LLAMA_TIMEOUT" || error?.code === "LLAMACPP_TIMEOUT" || error?.message?.includes("timed out")) {
                code = "LLM_UNAVAILABLE";
                message = "Local AI model did not respond in time.";
            } else if (error?.code === "RETRIEVAL_TIMEOUT") {
                code = "RETRIEVAL_TIMEOUT";
                message = "Knowledge base retrieval timed out.";
            } else if (error?.code === "VECTOR_DB_UNAVAILABLE" || error?.message?.includes("Qdrant")) {
                code = "VECTOR_DB_UNAVAILABLE";
                message = "Vector database is currently unreachable.";
            } else if (error?.code === "DATABASE_UNAVAILABLE" || error?.name === "MongooseError" || error?.name === "MongoNetworkError") {
                code = "DATABASE_UNAVAILABLE";
                message = "Database is currently unreachable.";
            } else if (error?.code === "EMBEDDING_FAILED") {
                code = "EMBEDDING_FAILED";
                message = "Embedding generation failed.";
            } else if (error?.code === "CONTEXT_BUILD_FAILED") {
                code = "CONTEXT_BUILD_FAILED";
                message = "Failed to construct context for question.";
            }
            
            emitSseEvent({
                type: "error",
                event: "error",
                code,
                message,
                progress: 100
            });
            res.end();
        }
        return;
    }

    try {
        const questionText = (req.body.question || req.body.message || "").trim();
        const result = await getChatService().askQuestion({
            user: req.user,
            question: questionText,
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
        let code = error?.code || "CHAT_EXECUTION_ERROR";
        let statusCode = error?.statusCode || 500;
        let message = error?.message || "Chat request processing failed.";

        if (error?.code === "LLM_UNAVAILABLE" || error?.code === "LLAMACPP_UNAVAILABLE" || error?.code === "ECONNREFUSED" || error?.message?.includes("Local AI model unavailable")) {
            code = "LLM_UNAVAILABLE";
            statusCode = 503;
            message = "Local AI model is currently unavailable.";
        } else if (error?.code === "LLAMA_TIMEOUT" || error?.code === "LLAMACPP_TIMEOUT" || error?.message?.includes("timed out")) {
            code = "LLM_UNAVAILABLE";
            statusCode = 504;
            message = "Local AI model did not respond in time.";
        } else if (error?.code === "RETRIEVAL_TIMEOUT") {
            code = "RETRIEVAL_TIMEOUT";
            statusCode = 504;
            message = "Knowledge base retrieval timed out.";
        } else if (error?.code === "VECTOR_DB_UNAVAILABLE" || error?.message?.includes("Qdrant")) {
            code = "VECTOR_DB_UNAVAILABLE";
            statusCode = 503;
            message = "Vector database is currently unreachable.";
        } else if (error?.code === "DATABASE_UNAVAILABLE" || error?.name === "MongooseError" || error?.name === "MongoNetworkError") {
            code = "DATABASE_UNAVAILABLE";
            statusCode = 503;
            message = "Database is currently unreachable.";
        } else if (error?.code === "EMBEDDING_FAILED") {
            code = "EMBEDDING_FAILED";
            statusCode = 502;
            message = "Embedding generation failed.";
        } else if (error?.code === "CONTEXT_BUILD_FAILED") {
            code = "CONTEXT_BUILD_FAILED";
            statusCode = 500;
            message = "Failed to construct context for question.";
        }

        return res.status(statusCode).json({
            success: false,
            code,
            message
        });
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

const searchChats = asyncHandler(async (req, res) => {
    const chats = await getChatService().searchChats({
        user: req.user,
        query: req.query.q || req.query.query || ""
    });

    return sendSuccess(res, 200, "Chat history search results retrieved successfully.", chats);
});

module.exports = {
    askQuestion,
    listChats,
    getChatDetails,
    renameChat,
    deleteChat,
    searchChats,
    regenerateResponse,
    getSuggestedQuestions
};
