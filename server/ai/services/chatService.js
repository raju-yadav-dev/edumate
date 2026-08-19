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
const SearchManager = require("../../knowledge/SearchManager");
const RankingEngine = require("../../knowledge/RankingEngine");
const cacheService = require("../../services/cacheService");
const webCrawlerService = require("./webCrawlerService");
const { detectTypeAndDepartment } = require("../utils/queryParser");

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
    const normalizedQuestion = String(question || "").trim();
    const activeUser = user || buildGuestUser();

    if (!normalizedQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
    }

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

    // Expand "CSS" or "css" (Computational Sciences) and department abbreviations for better matching
    let expandedQuestion = normalizedQuestion;
    if (/\bcss\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion.replace(/\bcss\b/gi, "computational sciences");
    }

    console.log(`[RAG DEBUG] User query: "${normalizedQuestion}"`);
    if (expandedQuestion !== normalizedQuestion) {
        console.log(`[RAG DEBUG] Expanded query: "${expandedQuestion}"`);
    }

    // 1. Retrieve dialogue history memory context
    const { historyText, activeTopic, conversationContext } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 1500,
        parentId
    });

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

    // ==========================================
    // ADMIN DOCUMENT DELIVERY FEATURE
    // ==========================================
    const documentDeliveryService = require("../../services/documentDeliveryService");
    const docDeliveryResult = await documentDeliveryService.handleDocumentDelivery({
        user: activeUser,
        question: normalizedQuestion,
        conversationId,
        parentId,
        historyText
    });
    if (docDeliveryResult) {
        const responseTimeMs = Date.now() - startedAt;
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: docDeliveryResult,
            intent: "document_delivery",
            confidence: 0.9,
            provider: "system",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: docDeliveryResult.topic || activeTopic || "",
            entities: { conversationContext }
        });

        if (onChunk) {
            onChunk(docDeliveryResult.answer);
        }

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: docDeliveryResult.answer,
            intent: "document_delivery",
            intentConfidence: 0.9,
            confidence: docDeliveryResult.confidence,
            sources: docDeliveryResult.sources,
            sourceLabel: docDeliveryResult.sourceLabel || "📚 University Documents",
            provider: "system",
            responseTimeMs,
            suggestions: []
        };
    }

    // 2. Query Analysis (Topic Switch, Rewrite Query, Intent, Entities, Repeat Check)
    const analysisResult = await queryRewriterService.analyzeQuery({
        question: expandedQuestion,
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

    // Debug logging for development
    console.log(`\n[CONTEXT]\nCurrent topic: ${updatedContext?.currentTopic || "None"}`);
    console.log(`\n[CONTEXT]\nUser query: ${normalizedQuestion}`);
    console.log(`\n[CONTEXT]\nResolved query: ${rewrittenQuery}`);
    console.log(`\n[INTENT]\n${intent}\n`);

    if (clarificationPrompt) {
        const responseTimeMs = Date.now() - startedAt;
        const chat = await conversationService.saveMessageTurn({
            user: activeUser,
            conversationId,
            question: normalizedQuestion,
            response: { answer: clarificationPrompt, confidence: "high" },
            intent: Array.isArray(intent) ? intent.join(",") : String(intent || "unknown"),
            confidence: 0.9,
            provider: "system",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: resolvedActiveTopic,
            entities: { ...entities, conversationContext: updatedContext }
        });

        const suggestions = await suggestionsService.generateSuggestions({
            question: normalizedQuestion,
            answer: clarificationPrompt
        });

        if (onChunk) {
            onChunk(clarificationPrompt);
        }

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: clarificationPrompt,
            intent,
            intentConfidence: 0.9,
            confidence: "high",
            sources: [],
            sourceLabel: "EduMate Clarification",
            provider: "system",
            responseTimeMs,
            suggestions
        };
    }

    // ==========================================
    // CAMPUS NAVIGATION SPECIAL ROUTING
    // ==========================================
    const isNavigationGreeting = normalizedQuestion.toLowerCase().trim() === "campus navigation";
    const isDirectionRequest = 
        normalizedQuestion.toLowerCase().trim() === "yes, show directions" ||
        normalizedQuestion.toLowerCase().trim() === "yes show directions" ||
        /^(?:how do i reach there|show directions|get directions|how to get there|how to reach there)/i.test(normalizedQuestion);

    if (isDirectionRequest) {
        // Look up the last location discussed in this conversation history
        const lastTurns = await conversationService.getRecentMemory({
            userId: activeUser._id,
            conversationId,
            parentId
        });
        
        // Find the last assistant message containing building details
        let targetLocation = "";
        if (lastTurns && lastTurns.rawHistory) {
            for (let i = lastTurns.rawHistory.length - 1; i >= 0; i--) {
                const msg = lastTurns.rawHistory[i];
                if (msg.role === "assistant" && msg.content) {
                    const text = msg.content;
                    const matches = text.match(/(?:Building|Buliding)\s*:\s*(Building\s+[0-9ivx]+|[0-9ivx]+|\b[a-z]+\b)/i) || text.match(/(?:Building\s+[0-9ivx]+)/i);
                    if (matches) {
                        targetLocation = matches[0];
                    }
                    const nameMatches = text.match(/🏷️\s*([a-zA-Z0-9\s&()]+)/i) || text.match(/Name:\s*([a-zA-Z0-9\s&()]+)/i);
                    if (nameMatches) {
                        targetLocation += " " + nameMatches[1].trim().split("\n")[0];
                    }
                    if (targetLocation) {
                        break;
                    }
                }
            }
        }
        
        if (targetLocation) {
            const mapQuery = `route to ${targetLocation}`;
            console.log(`[CAMPUS NAV] Routing direction request: "${normalizedQuestion}" -> "${mapQuery}"`);
            
            const mapResult = await mapService.resolveLocationRequest({
                question: mapQuery,
                user: activeUser,
                userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null
            });
            
            const formatted = mapResult.found
                ? responseFormattingService.formatAnswer({
                    answer: mapResult.answer,
                    confidence: "high",
                    sources: mapResult.sources,
                    sourceLabel: SOURCE_LABELS.UNIVERSITY
                })
                : {
                    answer: mapResult.answer,
                    confidence: "low",
                    sources: []
                };
                
            if (mapResult.mapData) {
                formatted.mapData = mapResult.mapData;
            }
            if (mapResult.requiresLocationPermission) {
                formatted.requiresLocationPermission = true;
            }
            
            const responseTimeMs = Date.now() - startedAt;
            const chat = await conversationService.saveMessageTurn({
                user: activeUser,
                conversationId,
                question: normalizedQuestion,
                response: { answer: formatted.answer, confidence: "high" },
                intent: "travel_route",
                confidence: 0.9,
                provider: "system",
                responseTimeMs,
                userMessageId,
                assistantMessageId,
                parentId,
                topic: "campus_navigation",
                entities: { ...entities, conversationContext: updatedContext }
            });
            
            return {
                conversationId: chat?._id || conversationId || null,
                mode: activeUser._id ? "authenticated" : "guest",
                message: formatted.answer,
                intent: "travel_route",
                intentConfidence: 0.9,
                confidence: "high",
                sources: formatted.sources || [],
                sourceLabel: "📍 Campus Navigation",
                provider: "system",
                responseTimeMs,
                suggestions: ["No, thanks"],
                mapData: formatted.mapData || null,
                requiresLocationPermission: formatted.requiresLocationPermission || false
            };
        }
    }

    const isCampusNav = isNavigationGreeting || intent === "location" || isCampusNavigationQuery(rewrittenQuery);
    
    if (isCampusNav) {
        console.log(`[CAMPUS NAV] Detected campus navigation query: "${rewrittenQuery}"`);
        
        let textResponse = "";
        let filteredCampusChunks = [];
        
        if (isNavigationGreeting) {
            textResponse = `📍 Campus Navigation\n\nSure! Tell me where you want to go in the campus.`;
        } else {
            // Expand spelling variations internally for search
            const normalizedSearchQuery = normalizeLocationQuery(rewrittenQuery);
            
            // Retrieve ONLY campus navigation chunks
            const campusChunks = await SearchManager.searchLocalPdfs(normalizedSearchQuery, activeUser, 15, false, { sourceType: "campus_navigation" });
            filteredCampusChunks = campusChunks.filter(c => 
                c.metadata?.sourceType === "campus_navigation" || 
                (c.metadata?.category && c.metadata.category.startsWith("campus_navigation"))
            );
            
            console.log(`[CAMPUS NAV] Found ${filteredCampusChunks.length} relevant campus navigation chunks.`);
            
            // Debugging console logs requested by requirement 14
            console.log(`[CAMPUS NAV]\nQuery: ${rewrittenQuery}`);
            console.log(`[CAMPUS NAV]\nNormalized query: ${normalizedSearchQuery}`);
            console.log(`[CAMPUS NAV]\nIntent: campus_navigation`);
            console.log(`[CAMPUS NAV]\nSearching buildings: 1-9`);
            if (filteredCampusChunks.length > 0) {
                const firstMatch = filteredCampusChunks[0];
                console.log(`[CAMPUS NAV]\nMatched source: ${firstMatch.metadata?.originalName || firstMatch.metadata?.filename || "Unknown"}`);
                console.log(`[CAMPUS NAV]\nBuilding: ${firstMatch.metadata?.buildingNumber || "N/A"}`);
                console.log(`[CAMPUS NAV]\nFloor: ${firstMatch.metadata?.floor || "N/A"}`);
                console.log(`[CAMPUS NAV]\nRoom: ${firstMatch.metadata?.roomNumber || "N/A"}`);
            }

            const chunksText = filteredCampusChunks.map((c, idx) => {
                return `[Source: ${c.metadata?.filename || c.metadata?.originalName || "Unknown"}]\n${c.content}`;
            }).join("\n\n");
            
            const systemPrompt = `You are a precise university campus navigation assistant.
Your job is to answer the user's campus location question using ONLY the retrieved campus navigation chunks.

Retrieved Chunks:
${chunksText || "No campus navigation data found."}

Rules:
1. Answer ONLY from the retrieved chunks. Do NOT assume, infer, guess, or hallucinate.
2. The response for a successful location query must follow this exact format:
   Building [Number] ([Building Name] - e.g. "Ravindra Bhavan" instead of "Ravindra Bhavan Ground 001". Remove any floor/room location suffixes from the building name itself)
   [Floor]
   Room [Room Number]

   [requested room/person/department details, e.g. HOD of CSS:\nDr. ABC, or Room details:\nHOD of CSS\nDr. ABC]

   Make sure there is exactly one blank line before the requested details.
   Do NOT add any extra text or pleasantries like "Sure!", "Here is the location:", "I found the following:", or "Would you like directions to this location?". Only output the structured location format directly.
3. If multiple distinct locations, departments, or HODs are found in the chunks that could match the query (e.g. user asks "Where is the HOD?" and there are HODs for LAW, CSE, Computational Science), you MUST ask the user to clarify:
   "Which department are you looking for? Which HOD do you mean — [List the matching departments/roles]?"
   Do not guess or randomly select one.
4. If the exact location is NOT found in the retrieved chunks, you MUST say:
   "I couldn't find the exact location in the Campus Navigation data."
   Do NOT invent or guess a room number.
5. Never expose internal database IDs, embeddings, vector scores, or file paths.

User Question: "${rewrittenQuery}"`;

            const promptMessages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Question: ${rewrittenQuery}` }
            ];

            if (onChunk) {
                textResponse = await llmService.generateStream(promptMessages, onChunk, { signal });
            } else {
                textResponse = await llmService.generateCompletion(promptMessages);
            }

            // Clean up building name format to remove suffixes like "Ground 001", "Ground Floor", etc.
            textResponse = textResponse.replace(/(Building\s+[0-9ivx]+)\s*\(([^)]+)\)/ig, (match, bNum, bName) => {
                let cleanName = bName.replace(/\b(?:ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|floor|flour|level)\s*[0-9a-zA-Z]*\b/ig, "").trim();
                cleanName = cleanName.replace(/\b[0-9]{3,}\b/g, "").trim(); // Remove room numbers or codes like "001"
                return `${bNum} (${cleanName})`;
            });

            // Ensure double newlines for line breaks to prevent React Markdown from collapsing them in the UI
            const lines = textResponse.split("\n").map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length >= 3 && lines[0].toLowerCase().startsWith("building ") && lines[2].toLowerCase().startsWith("room ")) {
                const bLine = lines[0];
                const fLine = lines[1];
                const rLine = lines[2];
                const details = lines.slice(3).join("\n\n");
                textResponse = `${bLine}\n\n${fLine}\n\n${rLine}\n\n${details}`;
            }

            // Append directions prompt programmatically for successful queries
            if (textResponse.toLowerCase().includes("building ") && textResponse.toLowerCase().includes("room ")) {
                textResponse += "\n\nWould you like directions to this location?";
            }
        }

        const suggestions = await suggestionsService.generateSuggestions({
            question: rewrittenQuery,
            answer: textResponse
        });

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

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: textResponse,
            intent: "location",
            intentConfidence: 0.9,
            confidence: "high",
            sources: filteredCampusChunks.map(c => ({
                type: "document",
                title: c.metadata?.filename || c.metadata?.originalName || "Campus Navigation",
                reference: c.metadata?.documentId || "campus-nav"
            })),
            sourceLabel: "📍 Campus Navigation",
            provider: "system",
            responseTimeMs,
            suggestions
        };
    }

    const intentResult = { intent, confidence: 0.9 };
    const primaryIntent = Array.isArray(intent) ? intent[0] : intent;
    const decision = decide({ intent: primaryIntent, question: rewrittenQuery });

    // 3. Clarification Handling
    const clarification = clarificationService.checkClarification({
        intent,
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
            intent,
            confidence: intentResult.confidence,
            provider: "system",
            responseTimeMs,
            userMessageId,
            assistantMessageId,
            parentId,
            topic: resolvedActiveTopic,
            entities: { ...entities, conversationContext: updatedContext }
        });

        const suggestions = await suggestionsService.generateSuggestions({
            question: normalizedQuestion,
            answer: clarification.answer
        });

        return {
            conversationId: chat?._id || conversationId || null,
            mode: activeUser._id ? "authenticated" : "guest",
            message: clarification.answer,
            intent,
            intentConfidence: intentResult.confidence,
            confidence: clarification.confidence,
            sources: clarification.sources,
            sourceLabel: SOURCE_LABELS.UNIVERSITY,
            provider: "system",
            responseTimeMs,
            suggestions
        };
    }

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

    if (decision.service === "deterministic") {
        formatted = deterministicGreeting(activeUser, language);
        textResponse = formatted.answer;
    } else if (decision.service === "map") {
        const mapResult = await mapService.resolveLocationRequest({
            question: rewrittenQuery,
            user: activeUser,
            userCoordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null,
            conversationContext: updatedContext
        });

        formatted = mapResult.found
            ? responseFormattingService.formatAnswer({
                answer: mapResult.answer,
                confidence: "high",
                sources: mapResult.sources,
                sourceLabel: SOURCE_LABELS.UNIVERSITY
            })
            : {
                answer: mapResult.answer,
                confidence: "low",
                sources: []
            };

        if (mapResult.mapData) {
            formatted.mapData = mapResult.mapData;
            // Update conversationContext with routing information if applicable
            if (mapResult.mapData.type === "routing") {
                updatedContext.routeStart = mapResult.mapData.startLocation;
                updatedContext.routeDestination = mapResult.mapData.destination;
                if (mapResult.mapData.selectedRouteNumber !== undefined) {
                    updatedContext.selectedRouteNumber = mapResult.mapData.selectedRouteNumber;
                }
            }
        }
        if (mapResult.requiresLocationPermission) {
            formatted.requiresLocationPermission = true;
        }
        textResponse = formatted.answer;
    } else {
        // Perform 3-Tier Sequential Fallback Search Pipeline with Query Decomposition
        const isUniversityRelated = classifyQuestionType(rewrittenQuery, intent) !== QUESTION_TYPES.GENERAL_KNOWLEDGE;

        let qdrantStart = 0;

        if (isUniversityRelated) {
            console.log(`[CHAT] Subquery RAG Search with ${activeSubqueries.length} subqueries:`, activeSubqueries);

            // ==========================================
            // TIER 1: ADMIN-UPLOADED DOCUMENTS
            // ==========================================
            console.log("[CHAT] Evaluating Tier 1 (Admin-Uploaded Documents)...");
            // ==========================================
            // TIER 1: ADMIN-UPLOADED DOCUMENTS (Intent-Specific & Validated)
            // ==========================================
            console.log("[CHAT] Evaluating Tier 1 (Admin-Uploaded Documents with Intent Decomposition)...");
            
            const targetIntents = [];
            const qCombined = (String(normalizedQuestion) + " " + String(rewrittenQuery)).toLowerCase();
            
            if (/\b(fee|fees|tuition|payment|cost|charge|charges)\b/i.test(qCombined)) {
                targetIntents.push("fee");
            }
            if (/\b(faculty|faculties|teacher|teachers|professor|professors|staff|instructor|instructors|members)\b/i.test(qCombined)) {
                targetIntents.push("faculty");
            }
            if (/\b(eligibility|criteria|requirement|requirements|qualification|qualifications|eligible)\b/i.test(qCombined)) {
                targetIntents.push("eligibility");
            }
            if (/\b(hod|head|chairperson|coordinator|dean|director)\b/i.test(qCombined)) {
                targetIntents.push("HOD");
            }
            if (/\b(duration|length|period|time|years|semesters|long)\b/i.test(qCombined)) {
                targetIntents.push("duration");
            }
            if (/\b(scholarship|scholarships|financial aid)\b/i.test(qCombined)) {
                targetIntents.push("scholarship");
            }
            if (/\b(admission|admissions|apply|application|enroll|enrollment|required documents)\b/i.test(qCombined)) {
                targetIntents.push("admission");
            }
            if (/\b(hostel|accommodation|residence|mess)\b/i.test(qCombined)) {
                targetIntents.push("hostel");
            }
            if (/\b(placement|placements|career|recruitment)\b/i.test(qCombined)) {
                targetIntents.push("placement");
            }
            
            if (targetIntents.length === 0) {
                if (intent === "fees") targetIntents.push("fee");
                else if (intent === "faculty") targetIntents.push("faculty");
                else targetIntents.push(intent || "general_chat");
            }
            
            const INTENT_EXPANSIONS = {
                fee: ["tuition fee", "course fee", "semester fee", "annual fee", "admission fee", "fee structure", "payment", "fees"],
                faculty: ["faculty details", "faculty members", "professors", "teachers", "teaching staff", "faculty list"],
                eligibility: ["eligibility criteria", "admission criteria", "eligibility requirements", "admission requirements", "qualification"],
                HOD: ["HOD", "head of department", "head of computational sciences", "department head", "HOD qualification", "HOD details"],
                duration: ["duration", "course duration", "duration of course", "course length", "how many years", "semesters"],
                scholarship: ["scholarship", "financial aid", "scholarships"],
                admission: ["admission process", "application", "required documents", "eligibility", "enrollment"],
                hostel: ["hostel", "accommodation", "residence", "mess"],
                placement: ["placements", "career", "recruitment", "job opportunities"]
            };

            const retrievedResultsByIntent = {};
            const combinedDocChunks = [];
            const docSeenIds = new Set();
            const adminDocumentsSearched = [];

            // Deterministic evidence validation: avoids an extra LLM request per intent.
            const validateEvidenceDeterministically = (tgtIntent, chunks) => {
                if (!Array.isArray(chunks) || chunks.length === 0) return [];
                const candidates = chunks.slice(0, Number(process.env.RAG_CANDIDATES_TO_VALIDATE) || 6);
                const patterns = {
                    fee: /(?:₹|rs\.?|inr|fee|fees|tuition|semester|annual|payment|amount|cost|charge)/i,
                    faculty: /(?:professor|prof\.?|teacher|lecturer|faculty|staff|designation|qualification)/i,
                    HOD: /(?:\bhod\b|head of department|department head|director|dean|chairperson)/i,
                    eligibility: /(?:eligib|criteria|requirement|qualification|minimum marks|admission)/i,
                    duration: /(?:duration|years?|semesters?|months?)/i,
                    scholarship: /(?:scholarship|financial aid|grant|stipend)/i,
                    admission: /(?:admission|application|enroll|enrollment|required documents|apply)/i,
                    hostel: /(?:hostel|accommodation|residence|mess)/i,
                    placement: /(?:placement|career|recruitment|job)/i
                };
                const pattern = patterns[tgtIntent] || null;
                return candidates.map((chunk, index) => {
                    const content = String(chunk.content || "");
                    const relevant = pattern ? pattern.test(content) : true;
                    return {
                        index,
                        relevant,
                        reason: relevant ? "Contains relevant evidence keywords." : "No direct evidence for this intent."
                    };
                });
            };

            for (const targetIntent of targetIntents) {
                const expansions = INTENT_EXPANSIONS[targetIntent];
                let searchQuery = rewrittenQuery;
                if (expansions) {
                    searchQuery = `${rewrittenQuery}, ${expansions.join(", ")}`;
                }

                console.log(`[RAG INTENT RETRIEVAL] Searching for intent: "${targetIntent}" with expanded query: "${searchQuery}"`);

                qdrantStart = Date.now();
                let chunks = await SearchManager.searchLocalPdfs(searchQuery, activeUser, Number(process.env.RAG_MAX_CHUNKS_PER_INTENT) || 3);
                qdrantDuration += Date.now() - qdrantStart;
                resolvedType = chunks.resolvedType || resolvedType;
                resolvedDept = chunks.resolvedDept || resolvedDept;
                retrievalTelemetry = chunks.retrievalTelemetry || retrievalTelemetry;

                let ranked = await RankingEngine.rerankCandidates(searchQuery, chunks, activeUser);

                let validatedChunks = [];
                let validationDetails = [];

                if (ranked.length > 0) {
                    const validationResult = validateEvidenceDeterministically(targetIntent, ranked);
                    validationDetails = validationResult;
                    
                    for (const item of validationResult) {
                        if (item.relevant) {
                            const chunk = ranked[item.index];
                            if (chunk) {
                                validatedChunks.push(chunk);
                            }
                        }
                    }
                }

                if (validatedChunks.length === 0) {
                    console.log(`[RAG INTENT RETRIEVAL] No relevant evidence found for intent "${targetIntent}" in primary search. Searching again...`);
                    const broaderQuery = `${activeUser.institution || ""} ${targetIntent} ${entities?.course || resolvedActiveTopic || ""}`.trim();
                    qdrantStart = Date.now();
                    let fallbackChunks = await SearchManager.searchLocalPdfs(broaderQuery, activeUser, Number(process.env.RAG_MAX_CHUNKS_PER_INTENT) || 3);
                    qdrantDuration += Date.now() - qdrantStart;
                    resolvedType = fallbackChunks.resolvedType || resolvedType;
                    resolvedDept = fallbackChunks.resolvedDept || resolvedDept;
                    retrievalTelemetry = fallbackChunks.retrievalTelemetry || retrievalTelemetry;

                    let fallbackRanked = await RankingEngine.rerankCandidates(broaderQuery, fallbackChunks, activeUser);
                    
                    if (fallbackRanked.length > 0) {
                        const fallbackValidationResult = validateEvidenceDeterministically(targetIntent, fallbackRanked);
                        validationDetails = fallbackValidationResult;
                        
                        for (const item of fallbackValidationResult) {
                            if (item.relevant) {
                                const chunk = fallbackRanked[item.index];
                                if (chunk) {
                                    validatedChunks.push(chunk);
                                }
                            }
                        }
                    }
                }

                retrievedResultsByIntent[targetIntent] = {
                    chunks: validatedChunks,
                    allCandidates: ranked,
                    validation: validationDetails
                };

                ranked.forEach(c => {
                    const docName = c.metadata?.filename || c.metadata?.originalName;
                    if (docName && !adminDocumentsSearched.includes(docName)) {
                        adminDocumentsSearched.push(docName);
                    }
                });

                for (const chunk of validatedChunks.slice(0, Number(process.env.RAG_MAX_CHUNKS_PER_INTENT) || 3)) {
                    if (!docSeenIds.has(chunk.id) && combinedDocChunks.length < (Number(process.env.RAG_MAX_CHUNKS) || 4)) {
                        docSeenIds.add(chunk.id);
                        combinedDocChunks.push(chunk);
                    }
                }
            }

            adminDocsCount = combinedDocChunks.length;
            
            let groundingInstructions = "";
            for (const targetIntent of targetIntents) {
                const validated = retrievedResultsByIntent[targetIntent]?.chunks || [];
                if (validated.length === 0) {
                    if (targetIntent === "fee") {
                        groundingInstructions += `\n- The fee information was not found in the Admin documents. You MUST return exactly: "The fee information was not found in the Admin documents." for the fee section. Do not fabricate, infer, or guess any fee. Do not classify course benefits/features as fees.`;
                    } else {
                        groundingInstructions += `\n- The ${targetIntent} information was not found in the Admin documents. You MUST explicitly state that the ${targetIntent} information was not found in the Admin documents.`;
                    }
                } else {
                    if (targetIntent === "fee") {
                        groundingInstructions += `\n- For the fee information: Answer ONLY from the retrieved evidence. Ensure you do not classify course benefits/features (labs, mentorship, projects) as fees. Do not infer or invent a fee. Do not use generic phrases like "average fee may be...", "typically...", "generally..." unless the user explicitly asks for general information.`;
                    }
                }
            }

            const webCrawlingEnabled = process.env.WEB_CRAWLING_ENABLED !== "false";
            const hasStrongContext = combinedDocChunks.length > 0 && RankingEngine.isConfident(combinedDocChunks);

            if (hasStrongContext || !webCrawlingEnabled) {
                console.log(`[CHAT] Running RAG search pipeline (Strong context: ${hasStrongContext}, Web crawling enabled: ${webCrawlingEnabled})`);
                console.log(`[CHAT] Strong institutional context verified with ${combinedDocChunks.length} chunks.`);

                const tempMessages = promptService.buildPromptMessages({
                    question: rewrittenQuery,
                    intent,
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

                if (tempMessages.length > 0 && tempMessages[0].role === "system") {
                    tempMessages[0].content += `\n\n## STRICT GROUNDING AND CONSTRAINTS FOR THIS QUERY\n1. Answer ONLY from retrieved evidence.\n2. If evidence is missing for a requested part of the question (e.g. fee or faculty), state exactly that the information was not found in the Admin documents. Do not fill missing evidence with general knowledge.\n3. For the fee section: do not classify course benefits/features (e.g. labs, mentorship, projects) as fees. Do not infer or invent a fee. Do not use generic phrases like "average fee may be...", "typically...", "generally..." unless the user explicitly asks for general information.\n4. Never let evidence retrieved for "faculty" satisfy the "fee" requirement.\n5. If the Admin documents do not contain the requested fee, return exactly: "The fee information was not found in the Admin documents." for that section.\n${groundingInstructions}`;
                }

                console.log("\n==================== [DEBUG RAG RETRIEVAL] ====================");
                console.log(`Question: ${normalizedQuestion}`);
                console.log(`Intent(s): ${targetIntents.join(", ")}`);
                console.log(`Admin documents searched:\n  ${adminDocumentsSearched.length > 0 ? adminDocumentsSearched.join("\n  ") : "None"}`);
                console.log("----------------------------------------------------------------");

                for (const targetIntent of targetIntents) {
                    const result = retrievedResultsByIntent[targetIntent];
                    if (result) {
                        console.log(`Intent: ${targetIntent}`);
                        console.log(`Top retrieved chunks & Scores:`);
                        result.allCandidates.slice(0, 5).forEach((c, idx) => {
                            console.log(`  [Chunk ${idx + 1}] Score: ${c.score.toFixed(4)} | Doc: ${c.metadata?.filename || c.metadata?.originalName} | Text: ${c.content.replace(/\n/g, " ").slice(0, 100)}...`);
                        });
                        console.log(`Evidence accepted/rejected:`);
                        result.validation.forEach((v) => {
                            const cand = result.allCandidates[v.index];
                            if (cand) {
                                console.log(`  [Chunk ${v.index + 1}] ${v.relevant ? "ACCEPTED" : "REJECTED"} | Reason: ${v.reason}`);
                            }
                        });
                        console.log("----------------------------------------------------------------");
                    }
                }

                console.log(`Final context sent to LLM:\n${JSON.stringify(tempMessages, null, 2)}`);
                console.log("===============================================================\n");

                if (onChunk) {
                    textResponse = "STREAMING_PLACEHOLDER";
                    retrievedChunks = combinedDocChunks;
                    activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                } else {
                    llmStart = Date.now();
                    let attemptResponse = await llmService.generateCompletion(tempMessages);
                    llmDuration += Date.now() - llmStart;
                    textResponse = attemptResponse;
                    retrievedChunks = combinedDocChunks;
                    activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                }
            } else {
                console.log("[CHAT] Weak institutional context or missing documentation. Falling back to Web Crawler...");
                const crawledResults = await webCrawlerService.searchAndScrape(rewrittenQuery);
                internetCount = crawledResults.length;

                const formattedWeb = crawledResults.map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.extractedContent || r.relevantSnippets || ""
                }));

                const tempMessages = promptService.buildPromptMessages({
                    question: rewrittenQuery,
                    intent,
                    retrievedChunks: [],
                    universitySiteResults: [],
                    webResults: formattedWeb,
                    historyText,
                    user: activeUser,
                    questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                    isRepeat,
                    activeTopic: resolvedActiveTopic,
                    language,
                    studentProfile
                });

                if (onChunk) {
                    textResponse = "STREAMING_PLACEHOLDER";
                    webResults = crawledResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                } else {
                    llmStart = Date.now();
                    const attemptResponse = await llmService.generateCompletion(tempMessages);
                    llmDuration += Date.now() - llmStart;
                    textResponse = attemptResponse;
                    webResults = crawledResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                }
            }
        } else {
            const webCrawlingEnabled = process.env.WEB_CRAWLING_ENABLED !== "false";
            if (webCrawlingEnabled) {
                console.log("[CHAT] General search query. Routing directly to Web Crawler...");
                const crawledResults = await webCrawlerService.searchAndScrape(rewrittenQuery);
                internetCount = crawledResults.length;

                const formattedWeb = crawledResults.map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.extractedContent || r.relevantSnippets || ""
                }));

                const tempMessages = promptService.buildPromptMessages({
                    question: rewrittenQuery,
                    intent,
                    retrievedChunks: [],
                    universitySiteResults: [],
                    webResults: formattedWeb,
                    historyText,
                    user: activeUser,
                    questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                    isRepeat,
                    activeTopic: resolvedActiveTopic,
                    language,
                    studentProfile
                });

                if (onChunk) {
                    textResponse = "STREAMING_PLACEHOLDER";
                    webResults = crawledResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                } else {
                    llmStart = Date.now();
                    const attemptResponse = await llmService.generateCompletion(tempMessages);
                    llmDuration += Date.now() - llmStart;
                    textResponse = attemptResponse;
                    webResults = crawledResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                }
            } else {
                console.log("[CHAT] General search query (Web Crawling Disabled). Querying LLM directly with empty context...");
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

                if (onChunk) {
                    textResponse = "STREAMING_PLACEHOLDER";
                    webResults = [];
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                } else {
                    llmStart = Date.now();
                    const attemptResponse = await llmService.generateCompletion(tempMessages);
                    llmDuration += Date.now() - llmStart;
                    textResponse = attemptResponse;
                    webResults = [];
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = process.env.LLM_PROVIDER || "groq";
                    finalMessages = tempMessages;
                }
            }
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

        // Call Unified LLM Service if streaming is active
        if (onChunk && finalMessages.length > 0) {
            textResponse = "";
            llmStart = Date.now();
            textResponse = await llmService.generateStream(finalMessages, (chunk) => {
                onChunk(chunk);
            }, { signal });
            llmDuration += Date.now() - llmStart;
            provider = process.env.LLM_PROVIDER || "groq";
        }

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
                providerSuccess: provider === "groq",
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

    return {
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
