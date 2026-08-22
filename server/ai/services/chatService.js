const Chat = require("../../models/Chat");
const { classifyQuestionType, QUESTION_TYPES } = require("../../services/intentService");
const { decide } = require("../../services/decisionEngine");
const mapService = require("../../services/mapService");
const responseValidator = require("../../services/responseValidator");
const AI_CONSTANTS = require("../constants/aiConstants");

// AI module services
const llmService = require("./llmService");
const llama = require("../../config/llama");
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
const askQuestion = async ({ user, question, conversationId, onChunk, signal, latitude, longitude, userMessageId, assistantMessageId, parentId, language }) => {
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

    // Parse lightweight metadata type and department
    const { documentType: detectedType, department: detectedDept } = detectTypeAndDepartment(normalizedQuestion);
    const { detectQueryMode } = require("../utils/queryParser");
    const queryMode = detectQueryMode(normalizedQuestion);

    // Check Cache first
    const cachedResponse = await cacheService.get(normalizedQuestion, detectedType, detectedDept, queryMode);
    if (cachedResponse) {
        const responseTimeMs = Date.now() - startedAt;
        console.log(`[Cache HIT] Found cached response for query: "${normalizedQuestion}" (Type: ${detectedType || 'none'}, Dept: ${detectedDept || 'none'})`);
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
            answer: cachedResponse.answer
        });

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
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

    // Expand abbreviation aliases in user question
    let expandedQuestion = normalizeAliases(normalizedQuestion);

    console.log(`[RAG DEBUG] User query: "${normalizedQuestion}"`);
    if (expandedQuestion !== normalizedQuestion) {
        console.log(`[RAG DEBUG] Expanded query: "${expandedQuestion}"`);
    }

    let maxOutputTokens = 500;

    // 1. Retrieve dialogue history memory context
    const { historyText, activeTopic, conversationContext, rawHistory } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 1500,
        parentId
    });

    // ==========================================
    // COURSE CATALOGUE ROUTING & LEVEL SELECTION
    // ==========================================


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
    const adaptiveRetrievalService = require("../../services/adaptiveRetrievalService");
    const queryType = queryComplexityService.analyzeQueryComplexity(rewrittenQuery, intent);
    console.log(`[ADAPTIVE RAG] Query Complexity Class: ${queryType}`);

    // Debug logging for development
    console.log(`\n[CONTEXT]\nCurrent topic: ${updatedContext?.currentTopic || "None"}`);
    console.log(`\n[CONTEXT]\nUser query: ${normalizedQuestion}`);
    console.log(`\n[CONTEXT]\nResolved query: ${rewrittenQuery}`);
    console.log(`\n[INTENT]\n${intent}\n`);




                  // ==========================================
    // CAMPUS NAVIGATION GREETING CHECK
    // ==========================================
    const isNavigationGreeting = normalizedQuestion.toLowerCase().trim() === "campus navigation";
    if (isNavigationGreeting) {
        const textResponse = `📍 Campus Navigation\n\nSure! Tell me where you want to go in the campus.`;
        const responseTimeMs = Date.now() - startedAt;
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: { answer: textResponse, confidence: "high" },
            intent: "location",
            confidence: 0.9,
            provider: "system",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: "campus_navigation",
            entities: { ...entities, conversationContext: updatedContext }
        });

        const suggestions = ["Where is the HOD of CSS?", "Where is the library?"];

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: textResponse,
            intent: "location",
            intentConfidence: 0.9,
            confidence: "high",
            sources: [],
            sourceLabel: "📍 Campus Navigation",
            provider: "system",
            responseTimeMs,
            suggestions
        };
    }

    const intentResult = { intent, confidence: 0.9 };
    const primaryIntent = Array.isArray(intent) ? intent[0] : intent;
    const decision = decide({ intent: primaryIntent, question: rewrittenQuery });

    let retrievedChunks = [];
    let universitySiteResults = [];
    let webResults = [];
    let activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
    let sourceLabel = SOURCE_LABELS.UNIVERSITY;
    let formatted;
    let provider = "system";
    let textResponse = "";
    let finalMessages = [];

    // Counters for debug logging
    let adminDocsCount = 0;
    let adminUrlsCount = 0;
    let internetCount = 0;

    // ==========================================
    // UNIVERSAL RETRIEVER (QDRANT FIRST)
    // ==========================================
    let cachedResult = retrievalCache.get(normalizedQuestion);
    let retrievedChunksRaw = [];
    let combinedDocChunks = [];
    let retrievalTime = 0;
    let rerankTime = 0;
    let qdrantStart = 0;

    if (cachedResult) {
        console.log(`[RAG LRU Cache HIT] Found cached retrieval results for query: "${normalizedQuestion}"`);
        retrievedChunksRaw = cachedResult.retrievedChunksRaw;
        combinedDocChunks = cachedResult.combinedDocChunks;
        rewrittenQuery = cachedResult.rewrittenQuery;
    } else {
        const mongoose = require("mongoose");
        if (mongoose.connection.readyState === 1) {
            try {
                const { ensureCollection } = require("../config/qdrant");
                await ensureCollection();
            } catch (err) {
                console.error("[RAG] Qdrant connection check failed:", err.message);
            }

            qdrantStart = Date.now();
            try {
                const SearchManager = require("../../knowledge/SearchManager");
                // Retrieve topK = 8 chunks dynamically
                retrievedChunksRaw = await SearchManager.searchLocalPdfs(rewrittenQuery, activeUser, 8);
            } catch (retrieveErr) {
                console.error("[RAG] Vector retrieval failed. Falling back to MongoDB keyword search:", retrieveErr.message);
                try {
                    const Chunk = require("../../models/Chunk");
                    const words = rewrittenQuery.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
                    if (words.length > 0) {
                        const regexes = words.map(w => new RegExp(w, "i"));
                        const matched = await Chunk.find({ content: { $in: regexes } }).limit(8).lean();
                        retrievedChunksRaw = matched.map(c => ({
                            id: c._id.toString(),
                            content: c.content,
                            metadata: {
                                documentId: c.document?.toString() || "",
                                originalName: c.metadata?.originalName || "",
                                filename: c.metadata?.originalName || "",
                                pageNumber: c.metadata?.pageNumber || 1,
                                category: c.metadata?.category || "",
                                department: c.metadata?.department || "",
                                institution: c.metadata?.institution || "",
                                sourceType: "document",
                                uploadedFrom: "api"
                            },
                            score: 0.5
                        }));
                    }
                } catch (mongoErr) {
                    console.error("[RAG] MongoDB keyword fallback search failed:", mongoErr.message);
                }
            }
            retrievalTime = Date.now() - qdrantStart;
            qdrantDuration += retrievalTime;

            // Hybrid Rerank
            const rerankStart = Date.now();
            const RankingEngine = require("../../knowledge/RankingEngine");
            const rankedChunks = await RankingEngine.rerankCandidates(rewrittenQuery, retrievedChunksRaw, activeUser);
            combinedDocChunks = selectDiverseChunks(rankedChunks, 8);
            rerankTime = Date.now() - rerankStart;

            retrievalCache.set(normalizedQuestion, {
                rewrittenQuery,
                retrievedChunksRaw,
                combinedDocChunks
            });
        }
    }

    const hasStrongContext = combinedDocChunks.length > 0;
    
    // Set parameters for final formatting
    retrievedChunks = combinedDocChunks;
    adminDocsCount = combinedDocChunks.length;

    if (hasStrongContext) {
        maxOutputTokens = 800;
        if (queryType === "DETAILED" || queryType === "FEE_STRUCTURE" || queryType === "RECOMMENDATION") {
            maxOutputTokens = 2000;
        }

        const contextStart = Date.now();
        const tempMessages = promptService.buildPromptMessages({
            question: rewrittenQuery,
            intent: recPrimaryIntent || intent,
            retrievedChunks: combinedDocChunks,
            universitySiteResults: [],
            webResults: [],
            historyText,
            user: activeUser,
            questionType: QUESTION_TYPES.UNIVERSITY_SPECIFIC,
            isRepeat,
            activeTopic: resolvedActiveTopic,
            language,
            studentProfile
        });
        const contextTime = Date.now() - contextStart;

        if (process.env.NODE_ENV === "development") {
            console.log("\n[RAG TRACE]");
            console.log(`query: ${rawQuestion}`);
            console.log(`normalizedQuery: ${normalizedQuestion}`);
            console.log(`retrievedCount: ${retrievedChunksRaw.length}`);
            console.log(`topScores: ${retrievedChunksRaw.slice(0, 5).map(c => c.score).join(", ")}`);
            console.log(`selectedChunks: ${JSON.stringify(combinedDocChunks.map(c => ({ filename: c.metadata?.filename, page: c.metadata?.pageNumber, score: c.score })))}`);
            console.log(`filteredChunks: []`);
            console.log(`filterReasons: []`);
            console.log(`contextChunks: ${combinedDocChunks.length}`);
            console.log(`retrievalMs: ${retrievalTime}`);
            console.log(`contextBuildMs: ${contextTime}`);
            console.log(`totalBeforeLLM: ${retrievalTime + rerankTime + contextTime}`);
            console.log("");
        }

        const topScore = combinedDocChunks.length > 0 ? combinedDocChunks[0].score : 0;
        const totalRetrievalOverhead = retrievalTime + rerankTime + contextTime;
        const categories = Array.from(new Set(combinedDocChunks.map(c => c.metadata?.category || c.metadata?.sourceType).filter(Boolean)));

        // Debug Logs exactly matching required production keys
        console.log("\n[RAG]");
        console.log(`Query: ${rawQuestion}`);
        console.log(`Normalized Query: ${normalizedQuestion}`);
        console.log(`Retrieved Chunk Count: ${retrievedChunksRaw.length}`);
        console.log(`Top Similarity: ${topScore}`);
        console.log(`Categories Returned: ${categories.join(", ")}`);
        console.log(`Sources Used: ${JSON.stringify(combinedDocChunks.map(c => c.metadata?.filename || c.metadata?.originalName))}`);
        console.log(`Retrieval Time: ${retrievalTime} ms`);
        console.log(`Rerank Time: ${rerankTime} ms`);
        console.log(`Total Time: ${totalRetrievalOverhead} ms\n`);

        if (tempMessages.length > 0 && tempMessages[0].role === "system") {
            tempMessages[0].content += `\n\n## STRICT GROUNDING AND CONSTRAINTS FOR THIS QUERY\n1. Answer ONLY from retrieved evidence.\n2. If evidence is missing for a requested part of the question, state exactly that the information was not found in the university knowledge base. Do not fill missing evidence with general knowledge.`;
        }

        // Comment out old LLM call:
        /*
        if (onChunk) {
            textResponse = "STREAMING_PLACEHOLDER";
            activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
            sourceLabel = SOURCE_LABELS.UNIVERSITY;
            provider = process.env.LLM_PROVIDER || "groq";
            finalMessages = tempMessages;
        } else {
            llmStart = Date.now();
            textResponse = await llmService.generateCompletion(tempMessages, { maxOutputTokens });
            llmDuration += Date.now() - llmStart;
            activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
            sourceLabel = SOURCE_LABELS.UNIVERSITY;
            provider = process.env.LLM_PROVIDER || "groq";
            finalMessages = tempMessages;
        }
        */

        // llama.cpp local call integration:
        const prompt = tempMessages && tempMessages.length > 1 ? tempMessages[1].content : (tempMessages && tempMessages[0] ? tempMessages[0].content : "");
        llmStart = Date.now();
        const completion = await llama.chat.completions.create({
          model: "Qwen3-4B-Instruct-Q4_K_M",
          messages: [
            {
              role: "system",
              content: "You are EduMate AI, a helpful university assistant."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 512,
        });

        let reply = "";
        if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
            reply = completion.choices[0].message.content;
        } else {
            reply = String(completion || "");
        }
        textResponse = reply;
        llmDuration += Date.now() - llmStart;
        activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
        sourceLabel = SOURCE_LABELS.UNIVERSITY;
        provider = "llama";
        
        if (onChunk) {
            onChunk(reply);
        }

        // Enrich with map service coordinates if location/navigation is requested
        if (recPrimaryIntent === "location" || recPrimaryIntent === "campus_navigation" || intent === "location" || intent === "campus_navigation") {
            try {
                const mapResult = await mapService.resolveLocationRequest({
                    question: rewrittenQuery,
                    user: activeUser,
                    userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null,
                    conversationContext: updatedContext
                });
                if (mapResult && mapResult.mapData) {
                    // Inject coordinates so the frontend can render map route components
                    formatted = formatted || {};
                    formatted.mapData = mapResult.mapData;
                }
            } catch (err) {
                console.error("Map service enrichment failed:", err.message);
            }
        }
    } else {
        // Fallback Logic when Universal Retriever yields nothing
        console.log("[RAG] Zero chunks returned. Executing fallback routing...");
        
        let fallbackDone = false;

        // Fallback 0: Genuinely unresolved ambiguity clarification
        if (clarificationPrompt) {
            console.log(`[FALLBACK CLARIFICATION] Returning unresolved ambiguity clarification: "${clarificationPrompt}"`);
            textResponse = clarificationPrompt;
            fallbackDone = true;
        }

        // Fallback 1: Course Catalogue Service
        const courseCatalogueService = require("../../services/courseCatalogueService");
        let selectedLevel = courseCatalogueService.checkLevelSelection(normalizedQuestion, rawHistory);
        let isCatalogQuery = false;
        
        if (selectedLevel) {
            isCatalogQuery = true;
        } else if (courseCatalogueService.isCourseCatalogueQuery(normalizedQuestion)) {
            isCatalogQuery = true;
            selectedLevel = courseCatalogueService.extractLevelFromQuestion(normalizedQuestion);
        }

        if (isCatalogQuery) {
            console.log(`[FALLBACK COURSE CATALOGUE] Detected catalogue query fallback. Level: ${selectedLevel || "None"}`);
            const catResponse = await courseCatalogueService.getCatalogueResponse(selectedLevel, language);
            textResponse = catResponse.answer;
            retrievedChunks = [];
            fallbackDone = true;
        }

        // Fallback 2: Map Service Directions
        if (!fallbackDone) {
            const isDirectionRequest = 
                normalizedQuestion.toLowerCase().trim() === "yes, show directions" ||
                normalizedQuestion.toLowerCase().trim() === "yes show directions" ||
                /^(?:how do i reach there|show directions|get directions|how to get there|how to reach there)/i.test(normalizedQuestion);

            if (isDirectionRequest || decision.service === "map") {
                console.log(`[FALLBACK MAP SERVICE] Executing map service fallback...`);
                const mapResult = await mapService.resolveLocationRequest({
                    question: rewrittenQuery,
                    user: activeUser,
                    userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null,
                    conversationContext: updatedContext
                });
                textResponse = mapResult.answer;
                fallbackDone = true;
            }
        }

        // Fallback 3: Document Delivery
        if (!fallbackDone) {
            const documentDeliveryService = require("../../services/documentDeliveryService");
            const docDeliveryResult = await documentDeliveryService.handleDocumentDelivery({
                user: activeUser,
                question: normalizedQuestion,
                conversationId,
                parentId,
                historyText
            });
            if (docDeliveryResult) {
                console.log(`[FALLBACK DOCUMENT DELIVERY] Executing document delivery fallback...`);
                textResponse = docDeliveryResult.answer;
                fallbackDone = true;
            }
        }

        // Fallback 4: Web Search / Web Scraper
        if (!fallbackDone && process.env.WEB_CRAWLING_ENABLED !== "false") {
            console.log("[FALLBACK WEB CRAWLER] Executing web search crawler fallback...");
            const crawledResults = await webCrawlerService.searchAndScrape(rewrittenQuery);
            internetCount = crawledResults.length;
            webResults = crawledResults.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.extractedContent || r.relevantSnippets || ""
            }));

            const tempMessages = promptService.buildPromptMessages({
                question: rewrittenQuery,
                intent,
                retrievedChunks: [],
                universitySiteResults: [],
                webResults,
                historyText,
                user: activeUser,
                questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                isRepeat,
                activeTopic: resolvedActiveTopic,
                language,
                studentProfile
            });

            // Gemini/Groq call commented out:
            /*
            if (onChunk) {
                textResponse = "STREAMING_PLACEHOLDER";
                activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                sourceLabel = SOURCE_LABELS.WEB;
                provider = process.env.LLM_PROVIDER || "groq";
                finalMessages = tempMessages;
            } else {
                llmStart = Date.now();
                textResponse = await llmService.generateCompletion(tempMessages, { maxOutputTokens: 800 });
                llmDuration += Date.now() - llmStart;
                activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                sourceLabel = SOURCE_LABELS.WEB;
                provider = process.env.LLM_PROVIDER || "groq";
                finalMessages = tempMessages;
            }
            */

            // llama.cpp local call integration:
            const prompt = tempMessages && tempMessages.length > 1 ? tempMessages[1].content : (tempMessages && tempMessages[0] ? tempMessages[0].content : "");
            llmStart = Date.now();
            const completion = await llama.chat.completions.create({
              model: "Qwen3-4B-Instruct-Q4_K_M",
              messages: [
                {
                  role: "system",
                  content: "You are EduMate AI, a helpful university assistant."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.3,
              max_tokens: 512,
            });

            let reply = "";
            if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
                reply = completion.choices[0].message.content;
            } else {
                reply = String(completion || "");
            }
            textResponse = reply;
            llmDuration += Date.now() - llmStart;
            activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
            sourceLabel = SOURCE_LABELS.WEB;
            provider = "llama";

            if (onChunk) {
                onChunk(reply);
            }
            fallbackDone = true;
        }

        // Fallback 5: General AI completion (no search context)
        if (!fallbackDone) {
            console.log("[FALLBACK GENERAL AI] Executing general AI fallback...");
            const tempMessages = promptService.buildPromptMessages({
                question: rewrittenQuery,
                intent,
                retrievedChunks: [],
                universitySiteResults: [],
                webResults: [],
                historyText,
                user: activeUser,
                questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                isRepeat,
                activeTopic: resolvedActiveTopic,
                language,
                studentProfile
            });

            // Gemini/Groq call commented out:
            /*
            if (onChunk) {
                textResponse = "STREAMING_PLACEHOLDER";
                activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                sourceLabel = SOURCE_LABELS.WEB;
                provider = process.env.LLM_PROVIDER || "groq";
                finalMessages = tempMessages;
            } else {
                llmStart = Date.now();
                textResponse = await llmService.generateCompletion(tempMessages, { maxOutputTokens: 800 });
                llmDuration += Date.now() - llmStart;
                activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                sourceLabel = SOURCE_LABELS.WEB;
                provider = process.env.LLM_PROVIDER || "groq";
                finalMessages = tempMessages;
            }
            */

            // llama.cpp local call integration:
            const prompt = tempMessages && tempMessages.length > 1 ? tempMessages[1].content : (tempMessages && tempMessages[0] ? tempMessages[0].content : "");
            llmStart = Date.now();
            const completion = await llama.chat.completions.create({
              model: "Qwen3-4B-Instruct-Q4_K_M",
              messages: [
                {
                  role: "system",
                  content: "You are EduMate AI, a helpful university assistant."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.3,
              max_tokens: 512,
            });

            let reply = "";
            if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
                reply = completion.choices[0].message.content;
            } else {
                reply = String(completion || "");
            }
            textResponse = reply;
            llmDuration += Date.now() - llmStart;
            activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
            sourceLabel = SOURCE_LABELS.WEB;
            provider = "llama";

            if (onChunk) {
                onChunk(reply);
            }
            fallbackDone = true;
        }

        // Debug Logs exactly matching required production keys
        console.log("\n[RAG]");
        console.log(`Query: ${rawQuestion}`);
        console.log(`Normalized Query: ${normalizedQuestion}`);
        console.log(`Retrieved Chunk Count: 0`);
        console.log(`Top Similarity: 0`);
        console.log(`Categories Returned: none`);
        console.log(`Sources Used: []`);
        console.log(`Retrieval Time: 0 ms`);
        console.log(`Rerank Time: 0 ms`);
        console.log(`Total Time: ${Date.now() - startedAt} ms\n`);
    }

    // Format citations
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

        // Call Unified LLM Service if streaming is active (commented out for llama.cpp local server)
        /*
        if (onChunk && finalMessages.length > 0) {
            textResponse = "";
            llmStart = Date.now();
            textResponse = await llmService.generateStream(finalMessages, (chunk) => {
                onChunk(chunk);
            }, { signal, maxOutputTokens });
            llmDuration += Date.now() - llmStart;
            provider = process.env.LLM_PROVIDER || "groq";
        }
        */

        if (!textResponse) {
            formatted = responseFormattingService.formatUnavailable({
                reason: "The requested details are not available in university documents, official website pages, or trusted web search."
            });
        } else {
            // Validate response
            const validation = responseValidator.validateResponse({
                intent,
                retrievedContext: { chunks: retrievedChunks, sources },
                generatedAnswer: textResponse,
                providerSuccess: provider === "llama",
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

    // Save to Cache if appropriate
    const shouldBypassCache = (decision.service === "map" || intent === "travel_route" || intent === "nearby");
    if (!shouldBypassCache && formatted && formatted.answer) {
        const cacheCategories = [];
        if (retrievedChunks && retrievedChunks.length > 0) {
            retrievedChunks.forEach(c => {
                if (c.metadata?.category && !cacheCategories.includes(c.metadata.category)) {
                    cacheCategories.push(c.metadata.category);
                }
            });
        }
        if (intent && typeof intent === "string") {
            const cleanIntent = intent.trim().toLowerCase();
            if (cleanIntent && cleanIntent !== "general_chat" && cleanIntent !== "unknown") {
                if (!cacheCategories.includes(cleanIntent)) {
                    cacheCategories.push(cleanIntent);
                }
            }
        }
        const isDynamic = (activeQuestionType === QUESTION_TYPES.GENERAL_KNOWLEDGE || String(normalizedQuestion).toLowerCase().includes("weather") || String(normalizedQuestion).toLowerCase().includes("today") || String(normalizedQuestion).toLowerCase().includes("current"));
        const cacheType = resolvedType || detectedType || "all";
        const cacheDept = resolvedDept || detectedDept || "all";
        const resolvedQueryMode = (retrievalTelemetry && retrievalTelemetry.queryMode) || queryMode || "targeted";
        await cacheService.set(normalizedQuestion, formatted, cacheCategories, isDynamic, cacheType, cacheDept, resolvedQueryMode);
    }

    const responseTimeMs = Date.now() - startedAt;
    console.log(`[Observability] Cache MISS | Qdrant Search Duration: ${qdrantDuration}ms | Chunks Retrieved: ${adminDocsCount} | LLM Generation Duration: ${llmDuration}ms | Total Response Duration: ${responseTimeMs}ms`);
    if (retrievalTelemetry) {
        console.log(`[Retrieval] Mode: ${retrievalTelemetry.queryMode} | Initial K: ${retrievalTelemetry.initialK} | Final K: ${retrievalTelemetry.finalK} | Candidates Before Dedup: ${retrievalTelemetry.candidatesBeforeDedup} | Candidates After Dedup: ${retrievalTelemetry.candidatesAfterDedup} | Final Chunks: ${retrievalTelemetry.finalCandidatesCount} | Tokens: ${retrievalTelemetry.finalTokens}`);
    }

    // DEVELOPMENT DEBUG LOGGING
    if (process.env.NODE_ENV === "development") {
        const totalResults = (retrievedChunks ? retrievedChunks.length : 0) + (webResults ? webResults.length : 0);
        const promptText = finalMessages.map(m => m.content).join("\n");
        const contextLength = promptText ? promptText.length : 0;
        const estimatedInputTokens = Math.ceil(contextLength / 4);
        
        console.log("\n[CHAT]");
        console.log(normalizedQuestion);
        console.log("\n[CONTEXT]");
        console.log(resolvedActiveTopic || "None");
        console.log("\n[QUERY]");
        console.log(rewrittenQuery);
        console.log("\n[RETRIEVAL]");
        console.log(`Admin Documents: ${adminDocsCount} results`);
        console.log(`Admin URLs: ${adminUrlsCount} results`);
        console.log(`Internet: ${internetCount} results`);
        console.log("\n[RERANK]");
        console.log(`Selected Results: ${totalResults}`);
        console.log("\n[LLM]");
        console.log(`Context Length: ${contextLength} chars (~${estimatedInputTokens} input tokens)\n`);
    }

    // 6. Save conversation turn to database
    const chat = await conversationService.saveMessageTurn({
        user: activeUser,
        conversationId,
        question: normalizedQuestion,
        response: formatted,
        intent: Array.isArray(intent) ? intent.join(",") : String(intent || "unknown"),
        confidence: intentResult.confidence,
        provider,
        responseTimeMs,
        userMessageId,
        assistantMessageId,
        parentId,
        topic: resolvedActiveTopic,
        entities: { ...entities, conversationContext: updatedContext },
        retrievalContext: {
            rewrittenQuery,
            adminDocsFound: adminDocsCount,
            adminUrlsFound: adminUrlsCount,
            internetResultsFound: internetCount
        }
    });

    // 7. Generate Follow-up Suggestions
    const suggestions = await suggestionsService.generateSuggestions({
        question: normalizedQuestion,
        answer: formatted.answer
    });

    const finalResult = {
        conversationId: chat?._id || conversationId || null,
        mode: activeUser._id ? "authenticated" : "guest",
        message: formatted.answer,
        intent,
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

    // Memory Safety: release temporary objects
    retrievedChunks = null;
    universitySiteResults = null;
    webResults = null;
    combinedDocChunks = null;
    retrievedChunksRaw = null;
    cachedResult = null;

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

module.exports = {
    askQuestion,
    listChats,
    getChatDetails,
    renameChat,
    deleteChat,
    regenerateResponse,
    getSuggestedQuestions
};
