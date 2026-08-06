const Chat = require("../../models/Chat");
const { classifyQuestionType, QUESTION_TYPES } = require("../../services/intentService");
const { decide } = require("../../services/decisionEngine");
const mapService = require("../../services/mapService");
const responseValidator = require("../../services/responseValidator");
const AI_CONSTANTS = require("../constants/aiConstants");

// AI module services
const llmService = require("./llmService");
const rerankService = require("./rerankService");
const conversationService = require("./conversationService");
const intentDetectionService = require("./intentDetectionService");
const entityExtractionService = require("./entityExtractionService");
const queryRewriterService = require("./queryRewriterService");
const clarificationService = require("./clarificationService");
const retrievalService = require("./retrievalService");
const webSearchService = require("./webSearchService");
const promptService = require("./promptService");
const responseFormattingService = require("./responseFormattingService");
const { SOURCE_LABELS } = responseFormattingService;
const citationService = require("./citationService");
const suggestionsService = require("./suggestionsService");
const knowledgeManager = require("../../knowledge/KnowledgeManager");

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

/**
 * Handles chatbot queries with RAG matching using Gemini 2.5 Flash and Qdrant
 */
const askQuestion = async ({ user, question, conversationId, onChunk, signal, latitude, longitude }) => {
    const startedAt = Date.now();
    const normalizedQuestion = String(question || "").trim();
    const activeUser = user || buildGuestUser();

    if (!normalizedQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
    }

    // 1. Retrieve dialogue history memory context
    const { historyText } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 1500
    });

    // 2. Intent Detection
    const intentResult = await intentDetectionService.detectIntent(normalizedQuestion);
    const decision = decide({ intent: intentResult.intent, question: normalizedQuestion });

    // 3. Entity Extraction
    const entities = await entityExtractionService.extractEntities(normalizedQuestion);

    // 4. Clarification Handling
    const clarification = clarificationService.checkClarification({
        intent: intentResult.intent,
        entities,
        question: normalizedQuestion
    });

    if (clarification) {
        const responseTimeMs = Date.now() - startedAt;
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: clarification,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            provider: "system",
            responseTimeMs
        });

        const suggestions = await suggestionsService.generateSuggestions({
            question: normalizedQuestion,
            answer: clarification.answer
        });

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: clarification.answer,
            intent: intentResult.intent,
            intentConfidence: intentResult.confidence,
            confidence: clarification.confidence,
            sources: clarification.sources,
            sourceLabel: SOURCE_LABELS.UNIVERSITY,
            provider: "system",
            responseTimeMs,
            suggestions
        };
    }

    // 5. Query Rewriting
    const rewrittenQuery = await queryRewriterService.rewriteQuery({
        question: normalizedQuestion,
        historyText
    });
    console.log(`Original: "${normalizedQuestion}" | Rewritten: "${rewrittenQuery}"`);

    let retrievedChunks = [];
    let universitySiteResults = [];
    let webResults = [];
    let activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
    let sourceLabel = SOURCE_LABELS.UNIVERSITY;
    let formatted;
    let provider = "system";

    if (decision.service === "deterministic") {
        formatted = deterministicGreeting(activeUser);
    } else if (decision.service === "map") {
        const mapResult = await mapService.resolveLocationRequest({
            question: rewrittenQuery,
            user: activeUser,
            userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null
        });

        formatted = mapResult.found
            ? responseFormattingService.formatAnswer({
                answer: mapResult.answer,
                confidence: "high",
                sources: mapResult.sources,
                sourceLabel: SOURCE_LABELS.UNIVERSITY
            })
            : responseFormattingService.formatUnavailable({ reason: mapResult.answer });

        if (mapResult.mapData) {
            formatted.mapData = mapResult.mapData;
        }
        if (mapResult.requiresLocationPermission) {
            formatted.requiresLocationPermission = true;
        }
    } else {
        // Perform 3-Tier Fallback Search Pipeline
        const isUniversityRelated = classifyQuestionType(rewrittenQuery, intentResult.intent) !== QUESTION_TYPES.GENERAL_KNOWLEDGE;

        if (isUniversityRelated) {
            console.log(`Smart Search Pipeline: Querying KnowledgeManager for prioritized source retrieval...`);
            try {
                const knowledgeResult = await knowledgeManager.search({
                    question: rewrittenQuery,
                    user: activeUser
                });
                
                retrievedChunks = knowledgeResult.chunks;
                webResults = knowledgeResult.webResults;
                universitySiteResults = [];

                const hasLocal = retrievedChunks.length > 0;
                const hasWeb = webResults.length > 0;

                if (hasLocal && hasWeb) {
                    activeQuestionType = QUESTION_TYPES.HYBRID;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                } else if (hasLocal) {
                    activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                } else if (hasWeb) {
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                } else {
                    activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                }
            } catch (searchError) {
                console.error("Parallel search pipeline encountered an unexpected error, falling back to General Web:", searchError);
                webResults = await webSearchService.searchTrustedWeb(rewrittenQuery);
                activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                sourceLabel = SOURCE_LABELS.WEB;
            }
        } else {
            console.log(`Query is not university related. Searching general trusted web directly...`);
            webResults = await webSearchService.searchTrustedWeb(rewrittenQuery);
            activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
            sourceLabel = SOURCE_LABELS.WEB;
        }

        // Format Citations
        const sources = citationService.formatCitations(retrievedChunks, universitySiteResults, webResults);

        // Enrich citations with signed download URLs
        const docIds = sources
            .filter(src => src.type === "document" && src.metadata?.documentId)
            .map(src => src.metadata.documentId);

        let signedUrlsMap = {};
        if (docIds.length > 0) {
            try {
                const Document = require("../../models/Document");
                const supabase = require("../../config/supabase");
                const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET;

                const docs = await Document.find({ _id: { $in: docIds } }).lean();
                const paths = docs.map(d => d.storagePath).filter(Boolean);
                
                if (paths.length > 0) {
                    const { data, error } = await supabase.storage
                        .from(BUCKET)
                        .createSignedUrls(paths, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 315360000);
                    
                    if (!error && data) {
                        const pathSignedUrlMap = {};
                        data.forEach(item => {
                            if (item.signedUrl) {
                                pathSignedUrlMap[item.path] = item.signedUrl;
                            }
                        });

                        docs.forEach(d => {
                            if (pathSignedUrlMap[d.storagePath]) {
                                signedUrlsMap[d._id.toString()] = pathSignedUrlMap[d.storagePath];
                            }
                        });
                    }
                }
            } catch (enrichError) {
                console.error("Failed to enrich citations with signed URLs:", enrichError);
            }
        }

        // Attach download/view URLs to sources
        sources.forEach(src => {
            if (src.type === "document" && src.metadata?.documentId) {
                const url = signedUrlsMap[src.metadata.documentId.toString()];
                if (url) {
                    src.downloadUrl = url;
                }
            }
        });

        // If context is required but empty, format unavailable
        if (decision.requiresVerifiedContext && sources.length === 0) {
            formatted = responseFormattingService.formatUnavailable({
                reason: AI_CONSTANTS.FALLBACK_RESPONSE
            });
        } else {
            // Build Prompt Messages
            const messages = promptService.buildPromptMessages({
                question: rewrittenQuery,
                intent: intentResult.intent,
                retrievedChunks,
                universitySiteResults,
                webResults,
                historyText,
                user: activeUser,
                questionType: activeQuestionType
            });

            // Call Unified LLM Service
            let textResponse = "";
            if (onChunk) {
                textResponse = await llmService.generateStream(messages, (chunk) => {
                    onChunk(chunk);
                }, { signal });
            } else {
                textResponse = await llmService.generateCompletion(messages);
            }
            provider = "groq";

            // Validate response against hallucinations
            const validation = responseValidator.validateResponse({
                intent: intentResult.intent,
                retrievedContext: { chunks: retrievedChunks, sources },
                generatedAnswer: textResponse,
                providerSuccess: true,
                questionType: activeQuestionType
            });

            formatted = validation.valid
                ? responseFormattingService.formatAnswer({
                    answer: textResponse,
                    confidence: validation.confidence,
                    sources,
                    sourceLabel
                })
                : responseFormattingService.formatUnavailable({ reason: validation.reason });
        }
    }

    // 6. Save conversation turn to database
    const responseTimeMs = Date.now() - startedAt;
    const chat = await conversationService.saveMessageTurn({
        user: activeUser,
        conversationId,
        question: normalizedQuestion,
        response: formatted,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        provider,
        responseTimeMs
    });

    // 7. Generate Follow-up Suggestions
    const suggestions = await suggestionsService.generateSuggestions({
        question: normalizedQuestion,
        answer: formatted.answer
    });

    return {
        conversationId: chat?._id || conversationId || null,
        mode: activeUser._id ? "authenticated" : "guest",
        message: formatted.answer,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        confidence: formatted.confidence,
        sources: formatted.sources,
        sourceLabel: formatted.sourceLabel || sourceLabel,
        provider,
        responseTimeMs,
        suggestions,
        mapData: formatted.mapData || null,
        requiresLocationPermission: formatted.requiresLocationPermission || false
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

const enrichChatMessagesWithUrls = async (messages) => {
    const docIds = [];
    const docTitles = [];
    messages.forEach(msg => {
        if (msg.role === "assistant" && msg.sources) {
            msg.sources.forEach(src => {
                if (src.type === "document") {
                    if (src.metadata?.documentId) {
                        docIds.push(src.metadata.documentId);
                    } else if (src.title) {
                        docTitles.push(src.title);
                    }
                }
            });
        }
    });

    if (docIds.length === 0 && docTitles.length === 0) return;

    try {
        const mongoose = require("mongoose");
        const Document = require("../../models/Document");
        const supabase = require("../../config/supabase");
        const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET;

        const orConditions = [];
        if (docIds.length > 0) {
            const validIds = docIds.filter(id => {
                try {
                    return mongoose.Types.ObjectId.isValid(id);
                } catch {
                    return false;
                }
            });
            if (validIds.length > 0) {
                orConditions.push({ _id: { $in: validIds } });
            }
        }
        if (docTitles.length > 0) {
            orConditions.push({ originalName: { $in: docTitles } });
        }

        if (orConditions.length === 0) return;

        const docs = await Document.find({ $or: orConditions, status: { $ne: "deleted" } }).lean();
        const paths = docs.map(d => d.storagePath).filter(Boolean);

        if (paths.length > 0) {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrls(paths, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 315360000);

            if (!error && data) {
                const pathSignedUrlMap = {};
                data.forEach(item => {
                    if (item.signedUrl) {
                        pathSignedUrlMap[item.path] = item.signedUrl;
                    }
                });

                const lookup = {};
                docs.forEach(d => {
                    const signedUrl = pathSignedUrlMap[d.storagePath];
                    if (signedUrl) {
                        lookup[d._id.toString()] = signedUrl;
                        lookup[d.originalName] = signedUrl;
                    }
                });

                messages.forEach(msg => {
                    if (msg.role === "assistant" && msg.sources) {
                        msg.sources.forEach(src => {
                            if (src.type === "document") {
                                let url = null;
                                if (src.metadata?.documentId) {
                                    url = lookup[src.metadata.documentId.toString()];
                                }
                                if (!url && src.title) {
                                    url = lookup[src.title];
                                }
                                if (url) {
                                    src.downloadUrl = url;
                                }
                            }
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error("Failed to enrich historical chat messages with signed URLs:", e);
    }
};

const getChatDetails = async ({ user, conversationId }) => {
    if (!user?._id || !conversationId) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 424;
        throw error;
    }
    const chatObj = chat.toObject();
    await enrichChatMessagesWithUrls(chatObj.messages);
    return chatObj;
};

const renameChat = async ({ user, conversationId, title }) => {
    if (!user?._id || !conversationId || !title?.trim()) {
        throw new Error("Invalid parameters.");
    }
    const chat = await Chat.findOne({ _id: conversationId, user: user._id, status: "active" });
    if (!chat) {
        const error = new Error("Chat not found.");
        error.statusCode = 424;
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
        error.statusCode = 424;
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
        error.statusCode = 424;
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

    return suggestionsService.generateSuggestions({
        question: lastQuery,
        answer: lastResponse
    });
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
