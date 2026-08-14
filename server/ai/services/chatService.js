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

/**
 * Handles chatbot queries with RAG matching using Gemini 2.5 Flash and Qdrant
 */
const askQuestion = async ({ user, question, conversationId, onChunk, signal, latitude, longitude, userMessageId, assistantMessageId, parentId, language }) => {
    const startedAt = Date.now();
    const normalizedQuestion = String(question || "").trim();
    const activeUser = user || buildGuestUser();

    if (!normalizedQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
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
    const { historyText, activeTopic } = await conversationService.getRecentMemory({
        userId: activeUser._id,
        conversationId,
        maxTokens: 1500,
        parentId
    });

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
            entities: {}
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
        activeTopic
    });
    const { rewrittenQuery, intent, entities, isRepeat, subqueries = [] } = analysisResult;
    const activeSubqueries = (Array.isArray(subqueries) && subqueries.length > 0) ? subqueries : [rewrittenQuery];
    const resolvedActiveTopic = analysisResult.activeTopic || activeTopic || "";

    const intentResult = { intent, confidence: 0.9 };
    const decision = decide({ intent, question: rewrittenQuery });

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
            entities
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
        textResponse = formatted.answer;
    } else {
        // Perform 3-Tier Sequential Fallback Search Pipeline with Query Decomposition
        const isUniversityRelated = classifyQuestionType(rewrittenQuery, intent) !== QUESTION_TYPES.GENERAL_KNOWLEDGE;

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
                duration: ["duration", "course duration", "duration of course", "course length", "how many years", "semesters"]
            };

            const retrievedResultsByIntent = {};
            const combinedDocChunks = [];
            const docSeenIds = new Set();
            const adminDocumentsSearched = [];

            const validateEvidenceWithLLM = async (tgtIntent, chunks, courseTopic) => {
                if (!chunks || chunks.length === 0) return [];
                const candidates = chunks.slice(0, 5);
                const chunksText = candidates.map((c, idx) => {
                    return `[Chunk Index: ${idx}]\nDocument: ${c.metadata?.filename || c.metadata?.originalName || "Unknown"}\nContent: ${c.content}`;
                }).join("\n\n");
                
                const systemPrompt = `You are a precise academic data auditor.
Analyze the provided text chunks and determine if they contain concrete, explicit, and factual evidence for the requested intent: "${tgtIntent}" for the course/subject: "${courseTopic || "general"}".

Validation Rules for Intent "fee":
- The text must contain actual fee, tuition, payment, or cost details (e.g. monetary amounts in INR/₹, payment rules, fee structures).
- Do NOT classify general course benefits/features (like "access to modern computer labs", "expert mentorship", "industry projects", "placement assistance") as fees.
- If a chunk mentions "fee structure" but contains no actual figures, payment details, or rules, it is NOT relevant.
- Do NOT infer or invent a fee.

Validation Rules for Intent "faculty":
- The text must contain information about faculty members, professors, teachers, lecturers, teaching staff (e.g., names, profiles, credentials).
- Do NOT accept general statements about "expert faculty" without names or specific details.

Validation Rules for Intent "eligibility":
- The text must contain admission criteria, eligibility requirements, minimum marks, or qualifications.

Validation Rules for Intent "HOD":
- The text must contain details about the HOD (Head of Department), department head, or director (e.g., name, qualification, role).

Validation Rules for Intent "duration":
- The text must contain the course duration or length (e.g., years, semesters).

For other intents:
- The text must contain direct, relevant answers to the intent.

Return a JSON array of objects, one for each chunk index, indicating if it is relevant. Format:
[
  { "index": 0, "relevant": true, "reason": "Contains actual fee figures." },
  { "index": 1, "relevant": false, "reason": "Only mentions labs and mentorship, which are benefits, not fees." }
]
Return ONLY a valid JSON block, without markdown formatting or backticks.`;

                const userPrompt = `Chunks to audit:\n\n${chunksText}`;
                
                try {
                    const response = await llmService.generateCompletion([
                        { role: "system", content: "You are a precise JSON evidence auditor." },
                        { role: "user", content: systemPrompt + "\n\n" + userPrompt }
                    ], { temperature: 0.1, maxOutputTokens: 300 });
                    
                    const cleaned = String(response)
                        .replace(/```json/g, "")
                        .replace(/```/g, "")
                        .trim();
                    const parsed = JSON.parse(cleaned);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                } catch (e) {
                    console.error(`[RAG EVIDENCE AUDIT] Audit failed for intent ${tgtIntent}:`, e.message);
                }
                return candidates.map((_, idx) => ({ index: idx, relevant: true, reason: "Fallback (audit failed)" }));
            };

            for (const targetIntent of targetIntents) {
                const expansions = INTENT_EXPANSIONS[targetIntent];
                let searchQuery = rewrittenQuery;
                if (expansions) {
                    searchQuery = `${rewrittenQuery}, ${expansions.join(", ")}`;
                }

                console.log(`[RAG INTENT RETRIEVAL] Searching for intent: "${targetIntent}" with expanded query: "${searchQuery}"`);

                let chunks = await SearchManager.searchLocalPdfs(searchQuery, activeUser, 10);
                let ranked = await RankingEngine.rerankCandidates(searchQuery, chunks, activeUser);

                let validatedChunks = [];
                let validationDetails = [];

                if (ranked.length > 0) {
                    const validationResult = await validateEvidenceWithLLM(targetIntent, ranked, entities?.course || resolvedActiveTopic);
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
                    let fallbackChunks = await SearchManager.searchLocalPdfs(broaderQuery, activeUser, 10);
                    let fallbackRanked = await RankingEngine.rerankCandidates(broaderQuery, fallbackChunks, activeUser);
                    
                    if (fallbackRanked.length > 0) {
                        const fallbackValidationResult = await validateEvidenceWithLLM(targetIntent, fallbackRanked, entities?.course || resolvedActiveTopic);
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

                for (const chunk of validatedChunks) {
                    if (!docSeenIds.has(chunk.id)) {
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

            if (combinedDocChunks.length > 0 || groundingInstructions !== "") {
                console.log(`[CHAT] Tier 1 verified as SUFFICIENT with ${combinedDocChunks.length} chunks.`);

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
                    language
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
                    provider = "groq";
                    finalMessages = tempMessages;
                } else {
                    let attemptResponse = await llmService.generateCompletion(tempMessages);

                    const performGroundingCheck = async (genAnswer, valChunks) => {
                        if (!genAnswer || genAnswer.trim() === "") return genAnswer;
                        if (valChunks.length === 0) return genAnswer;
                        const chunksText = valChunks.map((c, idx) => {
                            return `[Source: ${c.metadata?.filename || c.metadata?.originalName}, ChunkId: ${c.id}, DocumentId: ${c.metadata?.documentId}]\nContent: ${c.content}`;
                        }).join("\n\n");
                        
                        const gSystemPrompt = `You are a strict academic verification assistant.
Your task is to perform an evidence-grounding check on a generated chatbot answer.
Verify that every factual claim (names, numbers, criteria, etc.) in the answer is directly and explicitly supported by the provided source chunks.

Constraints:
1. Every factual claim MUST be traceable to a source chunk.
2. If a sentence in the answer contains any claim that is NOT found in the source chunks (e.g. general knowledge, external information, or inferred facts), you MUST rewrite or edit the answer to remove that ungrounded claim.
3. If the answer contains a statement like "The fee/faculty/HOD/eligibility information was not found in the Admin documents", that is a valid controlled response and is grounded.
4. Keep the same structure, tone, and formatting of the answer where possible, only removing or modifying ungrounded parts.
5. You MUST output the verified answer in the exact same language as the generated answer (e.g. if the answer is in Hindi, output in Hindi; if in Bengali, output in Bengali; if in English, output in English). Do NOT translate the answer to another language.

Output ONLY the verified, grounded answer text. Do not add any introduction, explanation, backticks, or markdown wrappers.`;

                        const gUserPrompt = `Source Chunks:\n${chunksText}\n\nGenerated Answer to verify:\n${genAnswer}`;
                        try {
                            const verified = await llmService.generateCompletion([
                                { role: "system", content: "You are a strict grounding verification assistant." },
                                { role: "user", content: gSystemPrompt + "\n\n" + gUserPrompt }
                            ], { temperature: 0.1 });
                            return String(verified).trim();
                        } catch (e) {
                            console.error("[RAG GROUNDING CHECK] Grounding check failed:", e.message);
                            return genAnswer;
                        }
                    };

                    attemptResponse = await performGroundingCheck(attemptResponse, combinedDocChunks);

                    textResponse = attemptResponse;
                    retrievedChunks = combinedDocChunks;
                    activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                    sourceLabel = SOURCE_LABELS.UNIVERSITY;
                    provider = "groq";
                    finalMessages = tempMessages;
                }
            }

            // ==========================================
            // TIER 2: ADMIN-APPROVED WEBSITE URLS (Bypassed for Phase 1 Focus on Admin Documents)
            // ==========================================
            if (!textResponse && false) {
                console.log("[CHAT] Tier 1 insufficient. Evaluating Tier 2 (Crawled Website URLs)...");
                const combinedSiteChunks = [];
                const siteSeenIds = new Set();

                for (const subq of activeSubqueries) {
                    const subCandidates = await SearchManager.searchApprovedUrls(subq, activeUser, 6);
                    const subRanked = await RankingEngine.rerankCandidates(subq, subCandidates, activeUser);

                    console.log("\n==================================================");
                    console.log(`QUERY: ${normalizedQuestion}`);
                    console.log(`SUBQUERY: ${subq}`);
                    console.log(`SOURCE: Crawled Website URLs (Tier 2)`);
                    if (subRanked.length === 0) {
                        console.log("DOCUMENT: None matched");
                        console.log("SCORE: 0");
                        console.log("RERANK SCORE: 0");
                        console.log("SELECTED CHUNKS: 0");
                    } else {
                        subRanked.forEach((chunk, idx) => {
                            console.log(`DOCUMENT: ${chunk.metadata?.originalName || chunk.metadata?.sourceUrl || "Webpage"}`);
                            console.log(`SCORE: ${chunk.initialScore ?? chunk.score}`);
                            console.log(`RERANK SCORE: ${chunk.rerankScore ?? chunk.score}`);
                            console.log(`SELECTED CHUNKS [${idx + 1}]: ${chunk.content.slice(0, 150).replace(/\n/g, " ")}...`);
                        });
                    }
                    console.log("==================================================\n");

                    const topSubChunks = subRanked.filter(c => c.score >= RankingEngine.SIMILARITY_CONFIDENCE_THRESHOLD);
                    const selectedForSub = topSubChunks.length > 0 ? topSubChunks.slice(0, 3) : subRanked.slice(0, 2);

                    for (const chunk of selectedForSub) {
                        if (!siteSeenIds.has(chunk.id)) {
                            siteSeenIds.add(chunk.id);
                            combinedSiteChunks.push(chunk);
                        }
                    }
                }

                adminUrlsCount = combinedSiteChunks.length;
                const maxSiteScore = combinedSiteChunks.length > 0 ? Math.max(...combinedSiteChunks.map(c => c.score)) : 0;

                if (maxSiteScore >= RankingEngine.SIMILARITY_CONFIDENCE_THRESHOLD && combinedSiteChunks.length > 0) {
                    console.log(`[CHAT] Tier 2 verified as SUFFICIENT with ${combinedSiteChunks.length} chunks.`);

                    const tempMessages = promptService.buildPromptMessages({
                        question: rewrittenQuery,
                        intent,
                        retrievedChunks: [],
                        universitySiteResults: combinedSiteChunks.map(c => ({
                            title: c.metadata?.originalName || "Webpage",
                            url: c.metadata?.sourceUrl || "",
                            snippet: c.content
                        })),
                        webResults: [],
                        historyText,
                        user: activeUser,
                        questionType: QUESTION_TYPES.UNIVERSITY_SPECIFIC,
                        isRepeat,
                        activeTopic: resolvedActiveTopic,
                        language
                    });

                    if (onChunk) {
                        textResponse = "STREAMING_PLACEHOLDER";
                        retrievedChunks = combinedSiteChunks;
                        activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                        sourceLabel = SOURCE_LABELS.UNIVERSITY;
                        provider = "groq";
                        finalMessages = tempMessages;
                    } else {
                        const attemptResponse = await llmService.generateCompletion(tempMessages);
                        textResponse = attemptResponse;
                        retrievedChunks = combinedSiteChunks;
                        activeQuestionType = QUESTION_TYPES.UNIVERSITY_SPECIFIC;
                        sourceLabel = SOURCE_LABELS.UNIVERSITY;
                        provider = "groq";
                        finalMessages = tempMessages;
                    }
                }
            }

            // ==========================================
            // TIER 3: INTERNET SEARCH (Bypassed for Phase 1 Focus on Admin Documents)
            // ==========================================
            if (!textResponse && false) {
                console.log("[CHAT] Tiers 1 & 2 insufficient. Evaluating Tier 3 (Internet Search)...");
                const combinedWebResults = [];
                const webSeenUrls = new Set();

                for (const subq of activeSubqueries) {
                    const internetResults = await SearchManager.searchInternet(subq);
                    for (const res of internetResults) {
                        if (res.url && !webSeenUrls.has(res.url)) {
                            webSeenUrls.add(res.url);
                            combinedWebResults.push(res);
                        }
                    }
                }

                internetCount = combinedWebResults.length;

                if (combinedWebResults.length > 0) {
                    const tempMessages = promptService.buildPromptMessages({
                        question: rewrittenQuery,
                        intent,
                        retrievedChunks: [],
                        universitySiteResults: [],
                        webResults: combinedWebResults,
                        historyText,
                        user: activeUser,
                        questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                        isRepeat,
                        activeTopic: resolvedActiveTopic,
                        language
                    });

                    if (onChunk) {
                        textResponse = "STREAMING_PLACEHOLDER";
                        webResults = combinedWebResults;
                        activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                        sourceLabel = SOURCE_LABELS.WEB;
                        provider = "groq";
                        finalMessages = tempMessages;
                    } else {
                        const attemptResponse = await llmService.generateCompletion(tempMessages);
                        textResponse = attemptResponse;
                        webResults = combinedWebResults;
                        activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                        sourceLabel = SOURCE_LABELS.WEB;
                        provider = "groq";
                        finalMessages = tempMessages;
                    }
                }
            }
        } else {
            console.log("[CHAT] General search: Skipping university context, going to Tier 3 directly...");
            const internetResults = await SearchManager.searchInternet(rewrittenQuery);
            internetCount = internetResults.length;

            if (internetResults.length > 0) {
                const tempMessages = promptService.buildPromptMessages({
                    question: rewrittenQuery,
                    intent,
                    retrievedChunks: [],
                    universitySiteResults: [],
                    webResults: internetResults,
                    historyText,
                    user: activeUser,
                    questionType: QUESTION_TYPES.GENERAL_KNOWLEDGE,
                    isRepeat,
                    activeTopic: resolvedActiveTopic,
                    language
                });

                if (onChunk) {
                    textResponse = "STREAMING_PLACEHOLDER";
                    webResults = internetResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = "groq";
                    finalMessages = tempMessages;
                } else {
                    const attemptResponse = await llmService.generateCompletion(tempMessages);
                    textResponse = attemptResponse;
                    webResults = internetResults;
                    activeQuestionType = QUESTION_TYPES.GENERAL_KNOWLEDGE;
                    sourceLabel = SOURCE_LABELS.WEB;
                    provider = "groq";
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
            textResponse = await llmService.generateStream(finalMessages, (chunk) => {
                onChunk(chunk);
            }, { signal });
            provider = "groq";
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

    // DEVELOPMENT DEBUG LOGGING
    if (process.env.NODE_ENV === "development") {
        const totalResults = (retrievedChunks ? retrievedChunks.length : 0) + (webResults ? webResults.length : 0);
        const promptText = finalMessages.map(m => m.content).join("\n");
        const contextLength = promptText ? promptText.length : 0;
        
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
        console.log(`Context Length: ${contextLength}\n`);
    }

    // 6. Save conversation turn to database
    const responseTimeMs = Date.now() - startedAt;
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
        entities,
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
