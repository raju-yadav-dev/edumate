const Chat = require("../../models/Chat");
const { classifyQuestionType, QUESTION_TYPES } = require("../../services/intentService");
const { decide } = require("../../services/decisionEngine");
const mapService = require("../../services/mapService");
const responseValidator = require("../../services/responseValidator");
const AI_CONSTANTS = require("../constants/aiConstants");

// AI module services
const llmService = require("./llmService");
const llama = require("../../config/llama");
const { getLlmConfig } = require("../../config/llm");
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
const SearchManager = require("../../knowledge/SearchManager");
const RankingEngine = require("../../knowledge/RankingEngine");
const cacheService = require("../../services/cacheService");
const webCrawlerService = require("./webCrawlerService");
const { detectTypeAndDepartment } = require("../utils/queryParser");
const { planQuery } = require("../utils/queryPlanner");
const performanceMonitoringService = require("../../services/performanceMonitoringService");
const LRUCache = require("../utils/lruCache");
const retrievalCache = new LRUCache(100, 5 * 60 * 1000);

const ALIASES_DICT = {
    "css": "computational sciences",
    "hod": "head of department",
    "ug": "undergraduate",
    "pg": "postgraduate",
    "placement cell": "training & placement cell"
};

const normalizeAliases = (text) => {
    let lower = String(text || "").toLowerCase();
    Object.entries(ALIASES_DICT).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        lower = lower.replace(regex, full);
    });
    return lower.replace(/\s+/g, " ").trim();
};

const isCampusNavigationQuery = (question) => {
    const q = String(question || "").toLowerCase();
    
    const locationKeywords = [
        "where is", "where is the", "where can i find", "where to find", "how to find",
        "location of", "which building", "which floor", "room number", "room no", "room",
        "where is room", "office of", "where is the office", "where can i get", "find the",
        "where to go for", "where is located", "how do i find"
    ];
    
    const campusTargets = [
        "hod", "head of department", "head of the department", "dean", "principal", "registrar",
        "counselor", "professor", "teacher", "staff", "faculty", "office", "cell", "lab", "canteen",
        "library", "seminar hall", "gym", "gymnasium", "auditorium", "counseling", "counselling",
        "admission", "admissions", "accounts", "examination", "exam", "sick room", "board room",
        "cash counter", "psychology", "cyber", "media", "nursing", "pharmaceutical", "pharmacy",
        "machine room", "boot camp", "languages", "language lab", "skills hub", "it support",
        "it office", "cisco", "red hat", "cyber security", "troubleshooting", "moot court",
        "digital logic", "computational science", "analytics", "management", "commerce",
        "applied mechanics", "fluid mechanics", "strength of materials", "soil science",
        "dynamic of machines", "x-ray", "plant science", "thermal power", "welding",
        "applied thermodynamics", "heat transfer", "ic engine", "pattern shop",
        "transportation engineering", "geology", "concrete", "retail", "racw", "health care",
        "ftcp", "f&b", "service lab", "veg items", "yoga", "building"
    ];

    if (/(?:building|buliding)\s*(?:[ivx0-9]+|\b[a-z]+\b)/i.test(q)) {
        return true;
    }
    if (/\b(?:room|office|lab)\s*[0-9]+/i.test(q)) {
        return true;
    }

    const hasLocationWord = locationKeywords.some(kw => q.includes(kw));
    const hasTarget = campusTargets.some(target => {
        const regex = new RegExp(`\\b${target}s?\\b`, "i");
        return regex.test(q);
    });

    return hasLocationWord && hasTarget;
};

const normalizeLocationQuery = (query) => {
    let q = String(query || "").toLowerCase();
    
    // Normalize B.Tech / BTECT / BTech
    if (/\b(?:b\.?tech|b\.?tect|b\s*tech|b\s*tect)\b/i.test(q)) {
        q += " btech b.tech btect b.tect b tech b tect";
    }
    
    // Normalize Maths / Mathematics
    if (/\bmaths?\b/i.test(q)) {
        q = q.replace(/\bmaths?\b/gi, "mathematics");
        q += " mathematics maths math";
    }
    
    // Normalize CS / Computer Science / CSE
    if (/\bcs\b/i.test(q)) {
        q = q.replace(/\bcs\b/gi, "computer science");
        q += " cs computer science cse c.s";
    }
    
    // Normalize BCA
    if (/\bbca\b/i.test(q)) {
        q += " bca b.c.a";
    }

    return q;
};

const deterministicGreeting = (user, language) => {
    let answer = `Hello ${user?.fullName || "there"}. I can help with institutional questions, documents, campus services, routes, and academic support.`;
    if (language === "hi") {
        answer = `नमस्ते ${user?.fullName || "वहाँ"}। मैं संस्थागत प्रश्नों, दस्तावेजों, कैंपस सेवाओं, मार्गों और शैक्षणिक सहायता के बारे में जानकारी देने में आपकी मदद कर सकता हूँ।`;
    } else if (language === "bn") {
        answer = `হ্যালো ${user?.fullName || "সেখানে"}। আমি আপনাকে প্রাতিষ্ঠানিক প্রশ্ন, নথিপত্র, ক্যাম্পাস পরিষেবা, রুট এবং একাডেমিক সহায়তা সম্পর্কিত তথ্যে সাহায্য করতে পারি।`;
    }
    return {
        answer,
        confidence: "high",
        sources: [
            {
                type: "system",
                title: "EduMate Assistant",
                reference: "deterministic-greeting"
            }
        ]
    };
};

const buildGuestUser = () => ({
    _id: null,
    fullName: "Guest",
    role: "guest",
    institution: "",
    department: ""
});

const buildRecommendationSearchQuery = (profile, institution = "Brainware University") => {
    let query = `Courses offered by ${institution}`;
    const parts = [];
    if (profile.stream) {
        parts.push(`${profile.stream} stream`);
    }
    if (profile.class) {
        parts.push(`Class ${profile.class}`);
    }
    if (profile.overall_percentage) {
        parts.push(`with ${profile.overall_percentage}% overall`);
    }
    if (profile.subject && profile.subject_percentage) {
        parts.push(`and ${profile.subject_percentage}% in ${profile.subject}`);
    } else if (profile.subject) {
        parts.push(`and ${profile.subject}`);
    }
    
    if (parts.length > 0) {
        query += ` suitable for a ${parts.join(" ")}`;
    }
    query += `, including eligibility requirements, stream eligibility, minimum marks, subject requirements, course focus, and admission criteria.`;
    return query;
};

const selectDiverseChunks = (rankedChunks, maxLimit = 8) => {
    if (!rankedChunks || rankedChunks.length === 0) return [];
    
    const selected = [];
    const seenDocIds = new Set();
    
    // 1. First pass: select the top-scoring chunk from each unique document
    for (const chunk of rankedChunks) {
        const docId = chunk.metadata?.documentId || chunk.metadata?.originalName || chunk.metadata?.filename;
        if (docId && !seenDocIds.has(docId)) {
            selected.push(chunk);
            seenDocIds.add(docId);
            if (selected.length >= maxLimit) break;
        }
    }
    
    // 2. Second pass: if we have remaining slots, fill them with other high-scoring chunks
    if (selected.length < maxLimit) {
        for (const chunk of rankedChunks) {
            if (!selected.some(c => c.id === chunk.id)) {
                selected.push(chunk);
                if (selected.length >= maxLimit) break;
            }
        }
    }
    
    // Keep original ranked order among selected chunks
    selected.sort((a, b) => b.score - a.score);
    return selected;
};

/**
 * Handles chatbot queries with RAG matching using Gemini 2.5 Flash and Qdrant
 */
const askQuestion = async ({ user, question, conversationId, onChunk, onStatus, signal, latitude, longitude, userMessageId, assistantMessageId, parentId, language }) => {
    const startedAt = Date.now();
    let llmStart = 0;
    let llmDuration = 0;
    let resolvedType = "all";
    let resolvedDept = "all";
    let qdrantDuration = 0;
    let retrievalTelemetry = null;
    const { normalizeQueryText, detectIntent } = require("../utils/queryParser");
    const rawQuestion = String(question || "").trim();
    if (!rawQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
    }

    const normalizedQuestion = normalizeQueryText(rawQuestion);
    const detectedIntent = detectIntent(normalizedQuestion);
    const activeUser = user || buildGuestUser();
    const tracker = performanceMonitoringService.createTracker({ question: normalizedQuestion, user: activeUser });

    // Prompt Injection Defense Check (Mission 19)
    const { inspectPromptSecurity } = require("../security/promptInjectionGuard");
    const securityCheck = inspectPromptSecurity(normalizedQuestion, {
        userId: activeUser._id,
        email: activeUser.email,
        role: activeUser.role,
        ipAddress: activeUser.ipAddress || "127.0.0.1"
    });

    if (securityCheck.isBlocked) {
        const blockedResponse = {
            message: securityCheck.fallbackMessage,
            answer: securityCheck.fallbackMessage,
            sources: [],
            citations: [],
            metadata: { isSecurityBlocked: true, intent: "SECURITY_GUARD" },
            confidence: 1.0,
            provider: "security-guard"
        };
        if (onChunk) onChunk(securityCheck.fallbackMessage);
        return blockedResponse;
    }

    // Parse lightweight metadata type and department
    const { documentType: detectedType, department: detectedDept } = detectTypeAndDepartment(normalizedQuestion);
    const { detectQueryMode } = require("../utils/queryParser");
    const queryMode = detectQueryMode(normalizedQuestion);

    // Check Cache first
    const cachedResponse = await cacheService.get(normalizedQuestion, detectedType, detectedDept, queryMode);
    if (cachedResponse) {
        const responseTimeMs = Date.now() - startedAt;
        const latencySaved = Math.max(150, 1200 - responseTimeMs);
        cacheService.recordLatencySaved(latencySaved);
        tracker.recordMetric("cacheHit", true);
        tracker.recordMetric("cacheMiss", false);
        tracker.recordMetric("cacheStatus", "hit");
        tracker.recordMetric("latencySavedMs", latencySaved);
        tracker.finish();
        console.log(`[Cache HIT] Found cached response for query: "${normalizedQuestion}" (Type: ${detectedType || 'none'}, Dept: ${detectedDept || 'none'}) | Saved: ${latencySaved}ms`);
        console.log(`[Observability] Cache HIT | Duration: ${responseTimeMs}ms | LLM Calls Avoided: 1`);
        if (onChunk && cachedResponse.answer) {
            onChunk(cachedResponse.answer);
        }
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: cachedResponse,
            intent: cachedResponse.intent || "cached",
            confidence: 1.0,
            provider: cachedResponse.provider || "cache",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: cachedResponse.topic || "",
            entities: { conversationContext }
        });

        const suggestions = await suggestionsService.generateSuggestions({
            question: normalizedQuestion,
            answer: cachedResponse.answer,
            intent: cachedResponse.intent
        });

        return {
            id: chat?._id,
            conversationId: chat?._id || conversationId,
            message: cachedResponse.answer,
            intent: cachedResponse.intent || "cached",
            intentConfidence: 1.0,
            confidence: cachedResponse.confidence,
            sources: cachedResponse.sources,
            sourceLabel: cachedResponse.sourceLabel || "Cached Q&A",
            provider: cachedResponse.provider || "cache",
            responseTimeMs,
            suggestions,
            mapData: cachedResponse.mapData || null,
            requiresLocationPermission: cachedResponse.requiresLocationPermission || false
        };
    }

    // Cache Miss
    tracker.recordMetric("cacheHit", false);
    tracker.recordMetric("cacheMiss", true);
    tracker.recordMetric("cacheStatus", "miss");

    // ==========================================
    // STAGE 1: INCOMING REQUEST
    // ==========================================
    console.log(`[STAGE 1: Incoming Request]`, {
        question: rawQuestion,
        userId: activeUser._id,
        role: activeUser.role,
        conversationId: conversationId || null,
        language: language || "en"
    });

    // Expand abbreviation aliases in user question
    let expandedQuestion = normalizeAliases(normalizedQuestion);

    console.log(`[RAG DEBUG] User query: "${normalizedQuestion}"`);
    if (expandedQuestion !== normalizedQuestion) {
        console.log(`[RAG DEBUG] Expanded query: "${expandedQuestion}"`);
    }

    let maxOutputTokens = 500;

    // 1. Retrieve dialogue history memory context (Mongo Lookup)
    const stopMongoHistoryTimer = tracker.startTimer("mongoLookup");
    const { historyText, activeTopic, conversationContext, rawHistory } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 500,
        parentId
    });
    stopMongoHistoryTimer();

    // ==========================================
    // BUG 1: AMBIGUOUS LOCATION QUERY CHECK
    // ==========================================
    const cleanQ = normalizedQuestion.replace(/[?.!]/g, "").trim().toLowerCase();
    const ambiguousLocationPatterns = {
        "building": "Sure. What would you like to know about the building?",
        "room": "Sure. Which room or person are you looking for?",
        "floor": "Sure. Which building or location are you referring to?",
        "campus": "What would you like to know about the campus?",
        "office": "Sure. Which office or department are you looking for?",
        "department": "Sure. Which department are you looking for?",
        "location": "Sure. What location or building are you trying to find?"
    };

    if (ambiguousLocationPatterns[cleanQ] !== undefined) {
        const answer = ambiguousLocationPatterns[cleanQ];
        console.log(`\n[INTENT]\nambiguous_location\n`);
        
        const responseTimeMs = Date.now() - startedAt;
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: { answer, confidence: "high" },
            intent: "ambiguous_location",
            confidence: 0.9,
            provider: "system",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: activeTopic || "",
            entities: { conversationContext }
        });

        if (onChunk) {
            onChunk(answer);
        }

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: answer,
            intent: "ambiguous_location",
            intentConfidence: 0.9,
            confidence: "high",
            sources: [],
            sourceLabel: "EduMate Clarification",
            provider: "system",
            responseTimeMs,
            suggestions: []
        };
    }

    // 2. Query Analysis (Topic Switch, Rewrite Query, Intent, Entities, Repeat Check)
    let followUpQuery = expandedQuestion;
    if (/\b(what\s+about|how\s+about|what\s+of)\s+(pg|ug|undergraduate|postgraduate)\b/i.test(normalizedQuestion)) {
        let previousIntent = "";
        if (rawHistory && rawHistory.length > 0) {
            for (let i = rawHistory.length - 1; i >= 0; i--) {
                const turn = rawHistory[i];
                if (turn.role === "user") {
                    const prevQuery = turn.content.toLowerCase();
                    if (prevQuery.includes("admission") || prevQuery.includes("eligibility") || prevQuery.includes("document") || prevQuery.includes("docs")) {
                        previousIntent = "Admissions";
                        break;
                    } else if (prevQuery.includes("fee") || prevQuery.includes("cost") || prevQuery.includes("pay")) {
                        previousIntent = "Fees";
                        break;
                    } else if (prevQuery.includes("course") || prevQuery.includes("program")) {
                        previousIntent = "Courses";
                        break;
                    }
                }
            }
        }
        
        const level = normalizedQuestion.includes("pg") || normalizedQuestion.includes("postgraduate") ? "postgraduate" : "undergraduate";
        if (previousIntent === "Admissions") {
            followUpQuery = `${level} admission documents required eligibility criteria`;
        } else if (previousIntent === "Fees") {
            followUpQuery = `${level} fee structure course cost`;
        } else if (previousIntent === "Courses") {
            followUpQuery = `${level} courses programs offered`;
        }
        console.log(`[RAG Memory] Follow-up query rewritten from "${normalizedQuestion}" to "${followUpQuery}"`);
    }

    const analysisResult = await queryRewriterService.analyzeQuery({
        question: followUpQuery,
        historyText,
        conversationContext,
        user: activeUser
    });
    let { rewrittenQuery, intent, entities, isRepeat, subqueries = [], conversationContext: updatedContext, clarificationPrompt } = analysisResult;
    let activeSubqueries = (Array.isArray(subqueries) && subqueries.length > 0) ? subqueries : [rewrittenQuery];

    let studentProfile = null;
    const { INTENTS } = require("../../constants/intents");
    const recPrimaryIntent = Array.isArray(intent) ? intent[0] : intent;
    
    if (recPrimaryIntent === INTENTS.COURSE_RECOMMENDATION) {
        studentProfile = await entityExtractionService.extractStudentProfile(normalizedQuestion, historyText);
        const recQuery = buildRecommendationSearchQuery(studentProfile, activeUser.institution || process.env.PRIMARY_UNIVERSITY_NAME || "Brainware University");
        console.log(`[COURSE_RECOMMENDATION] Formulated query: "${recQuery}"`);
        rewrittenQuery = recQuery;
        activeSubqueries = [recQuery];
    }
    const resolvedActiveTopic = analysisResult.activeTopic || activeTopic || "";

    const queryComplexityService = require("../../services/queryComplexityService");
    const queryType = queryComplexityService.analyzeQueryComplexity(rewrittenQuery, intent);

    // ==========================================
    // STAGE 2: QUERY CLASSIFICATION (Query Planner & Router)
    // ==========================================
    const stopPlannerTimer = tracker.startTimer("queryPlanner");
    const chatQueryPlan = planQuery(rewrittenQuery, {
        conversationHistory: historyText,
        historyText,
        activeTopic: resolvedActiveTopic,
        intent: recPrimaryIntent || intent,
        user: activeUser,
        studentProfile
    });
    stopPlannerTimer();

    const modeChosen = chatQueryPlan.mode || (chatQueryPlan.skipRag ? "LLM_ONLY" : "RAG_LLM");
    const routeChosen = chatQueryPlan.route || (modeChosen === "LLM_ONLY" ? "GENERAL_KNOWLEDGE" : (chatQueryPlan.isMixed ? "MIXED" : "UNIVERSITY_SPECIFIC"));
    const skipRag = Boolean(chatQueryPlan.skipRag);

    console.log(`[STAGE 2: Query Classification]`, {
        mode: modeChosen,
        route: routeChosen,
        isMixed: Boolean(chatQueryPlan.isMixed),
        intent: chatQueryPlan.intentCategory || chatQueryPlan.intent || recPrimaryIntent || intent,
        confidence: chatQueryPlan.routingDetails?.confidence || 0.95,
        skipRag,
        subqueries: activeSubqueries
    });

    // ==========================================
    // STAGE 3: METADATA FILTERS & TELEMETRY
    // ==========================================
    const stopFilterTimer = tracker.startTimer("metadataFilter");
    const metadataFilters = {
        category: chatQueryPlan.category || null,
        department: chatQueryPlan.department || null,
        program: chatQueryPlan.program || null,
        documentType: chatQueryPlan.documentType || null,
        ...(chatQueryPlan.filters || {})
    };
    tracker.recordMetric("metadataFilters", metadataFilters);
    tracker.recordMetric("modeChosen", modeChosen);
    tracker.recordMetric("routeChosen", routeChosen);
    tracker.recordMetric("skipRag", skipRag);
    stopFilterTimer();

    console.log(`[STAGE 3: Metadata Filters]`, metadataFilters);

    let retrievedChunks = [];
    let universitySiteResults = [];
    let webResults = [];
    let activeQuestionType = (modeChosen === "LLM_ONLY" || routeChosen === "GENERAL_KNOWLEDGE")
        ? QUESTION_TYPES.GENERAL_KNOWLEDGE 
        : (routeChosen === "CONVERSATIONAL" ? "conversational" : QUESTION_TYPES.UNIVERSITY_SPECIFIC);
    let sourceLabel = (modeChosen === "LLM_ONLY" || routeChosen === "GENERAL_KNOWLEDGE")
        ? "🤖 EduMate AI (General Knowledge)" 
        : (routeChosen === "CONVERSATIONAL" ? "💬 EduMate Assistant" : (chatQueryPlan.isMixed ? "📚 University Knowledge + General AI" : SOURCE_LABELS.UNIVERSITY));
    let formatted;
    let provider = "llama.cpp";
    let textResponse = "";

    let retrievedChunksRaw = [];
    let combinedDocChunks = [];
    let retrievalTime = 0;
    let rerankTime = 0;

    // ==========================================
    // STAGE 4: RETRIEVAL STATUS (Executed or Skipped)
    // ==========================================
    console.log(`[STAGE 4: Retrieval Status]`, {
        executed: !skipRag,
        reason: skipRag ? `RAG skipped for route: ${routeChosen}` : "Knowledge base retrieval scheduled"
    });

    if (!skipRag) {
        if (onStatus) {
            onStatus("Searching documents...", "searching_knowledge_base", { progress: 25 });
        }

        const stopQdrantTimer = tracker.startTimer("qdrant");
        let qdrantStart = Date.now();

        const RETRIEVAL_TIMEOUT_MS = 8000;
        let retrievalTimeoutHandle;
        const retrievalTimeoutPromise = new Promise((resolve) => {
            retrievalTimeoutHandle = setTimeout(() => {
                console.warn(`[CHAT PIPELINE] Retrieval exceeded ${RETRIEVAL_TIMEOUT_MS}ms timeout. Falling back to partial results.`);
                resolve([]);
            }, RETRIEVAL_TIMEOUT_MS);
        });

        try {
            const SearchManager = require("../../knowledge/SearchManager");
            retrievedChunksRaw = await Promise.race([
                SearchManager.searchLocalPdfs(rewrittenQuery, activeUser, 8),
                retrievalTimeoutPromise
            ]);
        } catch (retrieveErr) {
            console.error("[CHAT PIPELINE] Knowledge retrieval error:", retrieveErr.message);
            tracker.recordMetric("failedRetrievals", 1);
            retrievedChunksRaw = [];
        } finally {
            if (retrievalTimeoutHandle) clearTimeout(retrievalTimeoutHandle);
        }

        retrievalTime = Date.now() - qdrantStart;
        qdrantDuration += retrievalTime;
        stopQdrantTimer();

        const rawChunkIds = (retrievedChunksRaw || []).map(c => String(c.id || c.metadata?.chunkId || c._id || "")).filter(Boolean);
        tracker.recordMetric("retrievedChunkIds", rawChunkIds);
        tracker.recordMetric("chunksRetrieved", (retrievedChunksRaw || []).length);

        // ==========================================
        // CONTEXT BUILDER (Context Cache + Reranking & Selection)
        // ==========================================
        const stopContextTimer = tracker.startTimer("contextBuilder");
        const rerankStart = Date.now();

        // Check Context Cache first
        const cachedContext = await cacheService.getContextCache(rawChunkIds);
        if (cachedContext && Array.isArray(cachedContext) && cachedContext.length > 0) {
            combinedDocChunks = cachedContext;
            console.log(`[Context Cache HIT] Reused merged context for ${rawChunkIds.length} candidate chunks`);
        } else {
            const RankingEngine = require("../../knowledge/RankingEngine");
            const rankedChunks = await RankingEngine.rerankCandidates(rewrittenQuery, retrievedChunksRaw, activeUser);
            combinedDocChunks = selectDiverseChunks(rankedChunks, 8);
            if (rawChunkIds.length > 0 && combinedDocChunks.length > 0) {
                cacheService.setContextCache(rawChunkIds, combinedDocChunks).catch(() => {});
            }
        }
        rerankTime = Date.now() - rerankStart;
        stopContextTimer();

        tracker.recordMetric("chunksMerged", combinedDocChunks.length);
        tracker.recordTimer("retrieval", retrievalTime + rerankTime);

        if (onStatus) {
            onStatus(`Found ${combinedDocChunks.length} relevant document${combinedDocChunks.length === 1 ? "" : "s"}.`, "retrieval_completed", { 
                progress: 50, 
                count: combinedDocChunks.length 
            });
        }
    } else {
        tracker.recordMetric("chunksRetrieved", 0);
        tracker.recordMetric("chunksMerged", 0);
    }

    // ==========================================
    // STAGE 5: RETRIEVED CHUNK COUNT
    // ==========================================
    console.log(`[STAGE 5: Retrieved Chunk Count]`, {
        rawCandidates: (retrievedChunksRaw || []).length,
        selectedChunks: (combinedDocChunks || []).length,
        chunkIds: (combinedDocChunks || []).map(c => c.id || c.metadata?.chunkId || "chunk")
    });

    const hasStrongContext = combinedDocChunks.length > 0;
    retrievedChunks = combinedDocChunks;

    // ==========================================
    // STAGE 6, 7, 8, 9, 10: PROMPT & LLM GENERATION
    // ==========================================
    let ttftMsRecorded = 0;
    const shouldGenerateLlmResponse = (
        modeChosen === "LLM_ONLY" ||
        routeChosen === "GENERAL_KNOWLEDGE" || 
        routeChosen === "CONVERSATIONAL" || 
        modeChosen === "LLM_TOOLS" ||
        routeChosen === "LLM_TOOLS" ||
        routeChosen === "MIXED" || 
        (modeChosen === "RAG_LLM" && hasStrongContext) ||
        (routeChosen === "UNIVERSITY_SPECIFIC" && hasStrongContext) ||
        (modeChosen === "RAG_ONLY")
    );

    if (shouldGenerateLlmResponse) {
        if (onStatus) {
            onStatus("Building answer context...", "building_context", { progress: 65 });
        }

        const stopPromptTimer = tracker.startTimer("promptBuilder");
        const tempMessages = promptService.buildPromptMessages({
            question: rewrittenQuery,
            intent: recPrimaryIntent || intent,
            retrievedChunks: combinedDocChunks,
            universitySiteResults: [],
            webResults: [],
            historyText,
            user: activeUser,
            questionType: activeQuestionType,
            isRepeat,
            activeTopic: resolvedActiveTopic,
            language,
            studentProfile,
            queryPlan: chatQueryPlan,
            route: routeChosen
        });
        stopPromptTimer();
        const promptFullText = tempMessages.map(m => m.content).join("\n");
        const promptTokensEstimate = Math.round(promptFullText.length / 4);
        tracker.recordTokens({ promptText: promptFullText });

        // STAGE 6: Prompt Token Count
        console.log(`[STAGE 6: Prompt Token Count]`, {
            messagesCount: tempMessages.length,
            characterCount: promptFullText.length,
            estimatedTokens: promptTokensEstimate
        });

        if (onStatus) {
            onStatus("Generating answer...", "generating_response", { progress: 80 });
        }

        const llmConfig = getLlmConfig();
        const stopLlmTimer = tracker.startTimer("llm");
        llmStart = Date.now();

        // STAGE 7: llama.cpp Request Payload
        console.log(`[STAGE 7: llama.cpp Request Payload]`, {
            model: llmConfig.model,
            baseUrl: llmConfig.baseUrl,
            temperature: llmConfig.temperature,
            topP: llmConfig.topP,
            maxTokens: maxOutputTokens || llmConfig.maxTokens,
            stream: Boolean(onChunk && llmConfig.stream)
        });

        try {
            const completion = await llama.chat.completions.create({
                model: llmConfig.model,
                messages: tempMessages,
                temperature: llmConfig.temperature,
                top_p: llmConfig.topP,
                max_tokens: maxOutputTokens || llmConfig.maxTokens,
                stream: Boolean(onChunk && llmConfig.stream),
                onChunk,
                signal,
                conversationId,
                sessionId: conversationId,
                onFirstToken: (ttft) => {
                    ttftMsRecorded = ttft;
                    // STAGE 9: First Token Received
                    console.log(`[STAGE 9: First Token Received]`, {
                        ttftMs: ttft,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            let reply = "";
            if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
                reply = completion.choices[0].message.content;
            } else {
                reply = String(completion || "");
            }
            textResponse = reply;

            // STAGE 8: llama.cpp Response Status
            console.log(`[STAGE 8: llama.cpp Response Status]`, {
                status: 200,
                durationMs: Date.now() - llmStart,
                provider: llmConfig.provider
            });
        } catch (llmErr) {
            console.error("[STAGE 8: llama.cpp Response Status] Error:", llmErr.message || llmErr);
            if (routeChosen === "CONVERSATIONAL") {
                const greeting = deterministicGreeting(activeUser, language);
                textResponse = greeting.answer;
                if (onChunk) onChunk(textResponse);
            } else if (routeChosen === "GENERAL_KNOWLEDGE") {
                textResponse = `Here is information on your query: ${rawQuestion}. For comprehensive technical or academic details, feel free to explore specific curriculum resources.`;
                if (onChunk) onChunk(textResponse);
            } else {
                textResponse = "I could not retrieve an answer from the local model at this moment. Please check with official university resources.";
            }
        }

        stopLlmTimer();
        tracker.recordTokens({ completionText: textResponse });
        llmDuration += Date.now() - llmStart;

        // STAGE 10: Streaming Completion
        const speedTps = llmDuration > 0 ? Number((Math.round(textResponse.length / 4) / (llmDuration / 1000)).toFixed(1)) : 0;
        console.log(`[STAGE 10: Streaming Completion]`, {
            totalChars: textResponse.length,
            durationMs: llmDuration,
            ttftMs: ttftMsRecorded || llmDuration,
            speedTokensPerSec: speedTps
        });

        provider = llmConfig.provider;

        if (routeChosen === "MIXED") {
            sourceLabel = combinedDocChunks.length > 0 ? "📚 University Knowledge + General AI" : "🤖 EduMate AI (General Knowledge)";
        } else if (routeChosen === "GENERAL_KNOWLEDGE") {
            sourceLabel = "🤖 EduMate AI (General Knowledge)";
        } else if (routeChosen === "CONVERSATIONAL") {
            sourceLabel = "💬 EduMate Assistant";
        } else {
            sourceLabel = SOURCE_LABELS.UNIVERSITY;
        }

        // Campus Navigation Map Enrichment if applicable
        if (recPrimaryIntent === "location" || recPrimaryIntent === "campus_navigation" || intent === "location" || intent === "campus_navigation") {
            try {
                const mapResult = await mapService.resolveLocationRequest({
                    question: rewrittenQuery,
                    user: activeUser,
                    userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null,
                    conversationContext: updatedContext
                });
                if (mapResult && mapResult.mapData) {
                    formatted = formatted || {};
                    formatted.mapData = mapResult.mapData;
                }
            } catch (err) {
                console.error("Map service enrichment failed:", err.message);
            }
        }
    } else {
        // Zero chunks found for UNIVERSITY_SPECIFIC: Strict ungrounded fallback
        console.log("[CHAT PIPELINE] No relevant chunks found in knowledge base for UNIVERSITY_SPECIFIC query. Responding with strict ungrounded fallback.");
        textResponse = "I couldn't find matching information in the university knowledge base for that request. Please verify with the official university department or admissions office.";
        if (onChunk) {
            onChunk(textResponse);
        }
        activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
        sourceLabel = SOURCE_LABELS.UNIVERSITY;
        provider = "system";
    }

    // Format citations (only when knowledge retrieval was executed)
    const sources = skipRag ? [] : citationService.formatCitations(retrievedChunks, universitySiteResults, webResults);

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

            if (BUCKET && supabase?.storage) {
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
            }
        } catch (enrichError) {
            console.error("Failed to enrich citations with signed URLs:", enrichError.message);
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

    if (!textResponse) {
        if (routeChosen === "CONVERSATIONAL") {
            const greeting = deterministicGreeting(activeUser, language);
            textResponse = greeting.answer;
        } else if (routeChosen === "GENERAL_KNOWLEDGE") {
            textResponse = `EduMate AI: Here is what you asked regarding "${normalizedQuestion}". Please ask follow-up questions for more specific detail.`;
        } else {
            textResponse = "I couldn't find matching information in the university knowledge base for that request. Please verify with the official admissions desk.";
        }
    }

    // ==========================================
    // STAGE 11: RESPONSE VALIDATOR OUTPUT
    // ==========================================
    const validationResult = responseValidator.validateResponse({
        question: normalizedQuestion,
        intent: recPrimaryIntent || intent,
        retrievedContext: { chunks: retrievedChunks },
        generatedAnswer: textResponse,
        providerSuccess: Boolean(textResponse),
        questionType: activeQuestionType,
        sources
    });

    console.log(`[STAGE 11: Response Validator Output]`, {
        valid: validationResult.valid,
        confidence: validationResult.confidence,
        score: validationResult.score,
        reason: validationResult.reason
    });

    formatted = responseFormattingService.formatAnswer({
        answer: validationResult.groundedAnswer || textResponse,
        confidence: hasStrongContext ? (validationResult.confidence || "high") : (routeChosen === "GENERAL_KNOWLEDGE" || routeChosen === "CONVERSATIONAL" ? "high" : "low"),
        sources,
        sourceLabel,
        question: normalizedQuestion,
        intent: recPrimaryIntent || intent,
        queryPlan: chatQueryPlan
    });

    // Save to Cache if appropriate
    if (hasStrongContext && formatted && formatted.answer) {
        try {
            const cacheCategories = [];
            if (retrievedChunks && retrievedChunks.length > 0) {
                retrievedChunks.forEach(c => {
                    if (c.metadata?.category && !cacheCategories.includes(c.metadata.category)) {
                        cacheCategories.push(c.metadata.category);
                    }
                });
            }
            const isDynamic = false;
            const cacheType = resolvedType || detectedType || "all";
            const cacheDept = resolvedDept || detectedDept || "all";
            const resolvedQueryMode = queryMode || "targeted";
            await cacheService.set(normalizedQuestion, formatted, cacheCategories, isDynamic, cacheType, cacheDept, resolvedQueryMode);
        } catch (cacheErr) {
            console.warn("[Cache Set Warning]:", cacheErr.message);
        }
    }

    const responseTimeMs = Date.now() - startedAt;

    // Save conversation turn to database
    let chat = null;
    const stopSaveMongoTimer = tracker.startTimer("mongo");
    try {
        chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: formatted,
            intent: Array.isArray(intent) ? intent.join(",") : String(intent || "unknown"),
            confidence: hasStrongContext ? 0.95 : 0.4,
            provider,
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: resolvedActiveTopic,
            entities: { ...entities, conversationContext: updatedContext },
            retrievalContext: {
                rewrittenQuery,
                adminDocsFound: retrievedChunks ? retrievedChunks.length : 0
            }
        });
    } catch (saveErr) {
        console.warn("[Conversation Save Warning]:", saveErr.message);
    }
    stopSaveMongoTimer();

    // Finish tracking and log debug summary if enabled
    tracker.finish();

    // Generate Follow-up Suggestions
    let suggestions = [];
    try {
        suggestions = await suggestionsService.generateSuggestions({
            question: normalizedQuestion,
            answer: formatted.answer
        });
    } catch (suggErr) {
        suggestions = [];
    }

    const finalResult = {
        conversationId: chat?._id || conversationId || null,
        mode: activeUser._id ? "authenticated" : "guest",
        message: formatted.answer,
        intent,
        intentConfidence: hasStrongContext ? 0.95 : 0.4,
        confidence: formatted.confidence,
        sources: formatted.sources,
        sourceLabel: formatted.sourceLabel || sourceLabel,
        provider,
        responseTimeMs,
        suggestions,
        mapData: formatted.mapData || null,
        requiresLocationPermission: formatted.requiresLocationPermission || false
    };

    // ==========================================
    // STAGE 12: FINAL RESPONSE SENT TO FRONTEND
    // ==========================================
    console.log(`[STAGE 12: Final Response Sent to Frontend]`, {
        messageLength: finalResult.message.length,
        confidence: finalResult.confidence,
        sourceLabel: finalResult.sourceLabel,
        sourcesCount: finalResult.sources.length,
        responseTimeMs: finalResult.responseTimeMs
    });

    // Memory Safety: release temporary objects
    retrievedChunks = null;
    universitySiteResults = null;
    webResults = null;
    combinedDocChunks = null;
    retrievedChunksRaw = null;

    return finalResult;
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
    if (messages.length === 0) {
        throw new Error("No messages exist to regenerate.");
    }

    // Find the last assistant message to regenerate
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
            lastAssistantIdx = i;
            break;
        }
    }

    if (lastAssistantIdx === -1) {
        throw new Error("No assistant responses exist to regenerate.");
    }

    const assistantMsg = messages[lastAssistantIdx];
    // The parent of the assistant message is the user message
    const userMsg = messages.find(m => m.id === assistantMsg.parentId);
    if (!userMsg) {
        throw new Error("Matching user message not found.");
    }

    // Call askQuestion with the user message content and its parentId, to create a sibling branch
    return askQuestion({
        user,
        question: userMsg.content,
        conversationId,
        parentId: userMsg.parentId
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

const searchChats = async ({ user, query }) => {
    if (!user?._id) {
        throw new Error("User authentication required.");
    }
    const q = String(query || "").trim();
    if (!q) {
        return listChats({ user });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return Chat.find({
        user: user._id,
        status: "active",
        $or: [
            { title: regex },
            { summary: regex },
            { "messages.content": regex }
        ]
    })
    .select("title summary status pinned createdAt updatedAt")
    .sort({ pinned: -1, updatedAt: -1 });
};

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
