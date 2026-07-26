const Chat = require("../../models/Chat");
const { classifyIntent } = require("../../services/intentService");
const { decide } = require("../../services/decisionEngine");
const mapService = require("../../services/mapService");
const responseValidator = require("../../services/responseValidator");
const responseFormatter = require("../../services/responseFormatter");
const AI_CONSTANTS = require("../constants/aiConstants");

// AI module services
const gemini = require("../config/gemini");
const embeddingService = require("./embeddingService");
const retrievalService = require("./retrievalService");
const rerankService = require("./rerankService");
const promptService = require("./promptService");
const conversationService = require("./conversationService");
const citationService = require("./citationService");

const deterministicGreeting = (user) => ({
    answer: `Hello ${user?.fullName || "there"}. I can help with institutional questions, documents, campus services, routes, and academic support.`,
    confidence: "high",
    sources: [
        {
            type: "system",
            title: "EduMate Assistant",
            reference: "deterministic-greeting"
        }
    ]
});

const buildGuestUser = () => ({
    _id: null,
    fullName: "Guest",
    role: "guest",
    institution: "",
    department: ""
});

const shouldClarifyFees = (question) => {
    const normalized = question.toLowerCase();
    return /\b(fee|fees|tuition|payment|cost)\b/.test(normalized) &&
        !/\b(btech|b\.tech|mtech|m\.tech|mba|bca|mca|bba|ba|bsc|msc|course|program|department)\b/.test(normalized);
};

const shouldClarifyRoute = (question) => {
    const normalized = question.toLowerCase();
    return /\b(route|directions|how to reach|distance|travel|nearby)\b/.test(normalized) &&
        !/\b(from|to|near|current location|station|airport|bus stand|college)\b/.test(normalized);
};

const clarificationAnswer = (question) => {
    if (shouldClarifyFees(question)) {
        return {
            answer: "Which course or program do you want the fee structure for? For example: B.Tech CSE, BCA, MBA, hostel fee, admission fee, or semester fee.",
            confidence: "high",
            sources: [
                {
                    type: "system",
                    title: "EduMate Clarification",
                    reference: "fee-course-required"
                }
            ]
        };
    }

    if (shouldClarifyRoute(question)) {
        return {
            answer: "Please share your starting point and destination so I can compare possible routes, travel time, and approximate cost. Example: from Howrah Station to the college.",
            confidence: "high",
            sources: [
                {
                    type: "system",
                    title: "EduMate Clarification",
                    reference: "route-origin-destination-required"
                }
            ]
        };
    }

    return null;
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

/**
 * Handles chatbot queries with RAG matching using Gemini 2.5 Flash and ChromaDB
 */
const askQuestion = async ({ user, question, conversationId }) => {
    const startedAt = Date.now();
    const normalizedQuestion = String(question || "").trim();
    const activeUser = user || buildGuestUser();

    if (!normalizedQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
    }

    const intentResult = classifyIntent(normalizedQuestion);
    const decision = decide(intentResult);

    // 1. Retrieve dialogue history memory context
    const { historyText } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 1500
    });

    let retrievedChunks = [];
    let formatted;
    let provider = "system";

    const clarification = clarificationAnswer(normalizedQuestion);

    if (clarification) {
        formatted = clarification;
    } else if (decision.service === "deterministic") {
        formatted = deterministicGreeting(activeUser);
    } else if (decision.service === "map") {
        const mapResult = await mapService.resolveLocationRequest({
            question: normalizedQuestion,
            user: activeUser
        });

        formatted = mapResult.found
            ? responseFormatter.formatAnswer({
                answer: mapResult.answer,
                confidence: "high",
                sources: mapResult.sources
            })
            : responseFormatter.formatUnavailable({ reason: mapResult.answer });
    } else {
        // 2. Perform RAG pipeline
        try {
            // A. Generate embedding for query
            const queryEmbedding = await embeddingService.getQueryEmbedding(normalizedQuestion);

            // B. Semantic retrieval search
            const filter = {};
            if (activeUser.institution) filter.institution = activeUser.institution;
            if (activeUser.department) filter.department = activeUser.department;

            const chunks = await retrievalService.retrieveRelevantChunks({
                queryEmbedding,
                limit: AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT,
                filter
            });

            // C. Rerank extension point
            const reranked = await rerankService.rerank(normalizedQuestion, chunks);

            // D. Threshold filtering
            retrievedChunks = reranked.filter((chunk) => chunk.score >= AI_CONSTANTS.SIMILARITY_THRESHOLD);
        } catch (e) {
            console.error("Vector search or retrieval failed:", e.message);
        }

        const sources = citationService.formatCitations(retrievedChunks);

        if (decision.requiresVerifiedContext && sources.length === 0) {
            formatted = responseFormatter.formatUnavailable({
                reason: AI_CONSTANTS.FALLBACK_RESPONSE
            });
        } else {
            // E. Assemble grounded system instruction and user details prompts
            const messages = promptService.buildPromptMessages({
                question: normalizedQuestion,
                intent: intentResult.intent,
                retrievedChunks,
                historyText,
                user: activeUser
            });

            // F. Call Gemini completion endpoint
            const textResponse = await gemini.generateCompletion(messages);
            provider = "gemini-flash";

            // G. Validate the grounded quality of response
            const validation = responseValidator.validateResponse({
                intent: intentResult.intent,
                retrievedContext: { chunks: retrievedChunks, sources },
                generatedAnswer: textResponse,
                providerSuccess: true
            });

            formatted = validation.valid
                ? responseFormatter.formatAnswer({
                    answer: textResponse,
                    confidence: validation.confidence,
                    sources
                })
                : responseFormatter.formatUnavailable({ reason: validation.reason });
        }
    }

    // 3. Save conversation exchanges to MongoDB thread
    const chat = await getOrCreateChat({
        user: activeUser,
        conversationId,
        question: normalizedQuestion
    });

    const responseTimeMs = Date.now() - startedAt;

    if (chat) {
        chat.messages.push({
            role: "user",
            content: normalizedQuestion,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            provider: "user"
        });

        chat.messages.push({
            role: "assistant",
            content: formatted.answer,
            intent: intentResult.intent,
            confidence: formatted.confidence === "high" ? 0.9 : formatted.confidence === "medium" ? 0.65 : 0.25,
            sources: formatted.sources,
            provider,
            responseTimeMs
        });

        chat.updatedBy = activeUser._id;
        await chat.save();
    }

    return {
        conversationId: chat?._id || conversationId || null,
        mode: activeUser._id ? "authenticated" : "guest",
        message: formatted.answer,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        confidence: formatted.confidence,
        sources: formatted.sources,
        provider,
        responseTimeMs
    };
};

const listChats = async ({ user }) => {
    if (!user?._id) {
        throw new Error("User authentication required.");
    }
    return Chat.find({ user: user._id, status: "active" })
        .select("-messages")
        .sort({ updatedAt: -1 });
};

const getChatDetails = async ({ user, conversationId }) => {
    if (!user?._id || !conversationId) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 404;
        throw error;
    }
    return chat;
};

const renameChat = async ({ user, conversationId, title }) => {
    if (!user?._id || !conversationId || !title?.trim()) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 404;
        throw error;
    }
    chat.title = title.trim().slice(0, 80);
    chat.updatedBy = user._id;
    await chat.save();
    return chat;
};

const deleteChat = async ({ user, conversationId }) => {
    if (!user?._id || !conversationId) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 404;
        throw error;
    }
    chat.status = "deleted";
    chat.updatedBy = user._id;
    await chat.save();
    return chat;
};

const regenerateResponse = async ({ user, conversationId }) => {
    if (!user?._id || !conversationId) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 404;
        throw error;
    }

    const messages = chat.messages;
    if (messages.length < 2) {
        throw new Error("No responses exist to regenerate.");
    }

    if (messages[messages.length - 1].role === "assistant") {
        messages.pop();
    }

    if (messages[messages.length - 1].role !== "user") {
        throw new Error("Invalid conversation state.");
    }

    const lastUserQuery = messages[messages.length - 1].content;
    messages.pop();
    await chat.save();

    return askQuestion({
        user,
        question: lastUserQuery,
        conversationId
    });
};

const getSuggestedQuestions = async ({ user, conversationId }) => {
    const activeUser = user || buildGuestUser();
    let lastQuery = "";
    let lastResponse = "";

    if (conversationId && activeUser._id) {
        const chat = await Chat.findOne({ _id: conversationId, user: activeUser._id, status: "active" });
        if (chat && chat.messages.length >= 2) {
            const assistantMsg = chat.messages[chat.messages.length - 1];
            const userMsg = chat.messages[chat.messages.length - 2];
            if (assistantMsg.role === "assistant" && userMsg.role === "user") {
                lastQuery = userMsg.content;
                lastResponse = assistantMsg.content;
            }
        }
    }

    const suggestionsPrompt = require("../utils/promptBuilder").getSuggestedQuestionsPrompt();
    const messages = [
        { role: "system", content: suggestionsPrompt.system },
        { role: "user", content: suggestionsPrompt.formatUser(lastQuery, lastResponse) }
    ];

    try {
        const rawContent = await gemini.generateCompletion(messages, { temperature: 0.7 });
        const lines = rawContent
            .split("\n")
            .map((line) => line.trim().replace(/^[-*0-9.\s]+/, ""))
            .filter(Boolean)
            .slice(0, 3);

        if (lines.length > 0) {
            return lines;
        }
    } catch (e) {
        console.error("Error generating suggested questions:", e);
    }

    return [
        "What other documents are uploaded?",
        "Can I get details on admission criteria?",
        "What are the fee details for this department?"
    ];
};

module.exports = {
    askQuestion,
    listChats,
    getChatDetails,
    renameChat,
    deleteChat,
    regenerateResponse,
    getSuggestedQuestions
};
