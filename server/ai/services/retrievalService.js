const { client, collectionName, vectorName } = require("../config/qdrant");
const AI_CONSTANTS = require("../constants/aiConstants");
const { detectTypeAndDepartment, detectQueryMode } = require("../utils/queryParser");
const { planQuery } = require("../utils/queryPlanner");
const embeddingService = require("./embeddingService");
const { countTokens } = require("../utils/tokenizer");

const localChunkManager = require("../../storage/localChunkManager");

const COURSE_INFORMATION_TERMS = [
    "eligibility",
    "duration",
    "semester",
    "subjects",
    "fees",
    "curriculum",
    "career",
    "opportunities"
];

const isCompleteCourseQuery = (question, queryPlan) => {
    if (!queryPlan?.programs?.length) return false;
    return /\b(?:everything|complete|full|entire|overview|guide|details?|information|course)\b/i.test(String(question || ""));
};

/**
 * Builds Qdrant's nested filter format from flat metadata parameters
 * @param {Object} filter
 * @returns {Object|undefined}
 */
const buildQdrantFilter = (filter) => {
    if (!filter) return undefined;

    const must = [];
    const keys = Object.keys(filter).filter(
        (key) => filter[key] !== undefined && filter[key] !== null && String(filter[key]).trim() !== ""
    );

    for (const key of keys) {
        must.push({
            key,
            match: {
                value: filter[key]
            }
        });
    }

    return must.length > 0 ? { must } : undefined;
};

/**
 * Builds Qdrant payload filters from Query Planner output for metadata-first retrieval.
 */
const buildPlannerQdrantFilter = ({ 
    queryPlan, 
    user, 
    ignoreInstitution = false, 
    filter = null, 
    relaxHeading = false, 
    relaxDocType = false,
    relaxCategory = false 
}) => {
    const must = [];

    // 1. User institution constraint
    if (user?.institution && user.institution !== "all" && !ignoreInstitution) {
        must.push({
            should: [
                { key: "institution", match: { value: user.institution } },
                { key: "institution", match: { value: "all" } },
                { key: "institution", match: { value: "general" } },
                { key: "institution", match: { value: "" } }
            ]
        });
    }

    // 2. SourceType filter
    if (filter && filter.sourceType) {
        must.push({ key: "sourceType", match: { value: filter.sourceType } });
    }

    if (!queryPlan) {
        return must.length > 0 ? { must } : undefined;
    }

    // 3. Category filter (matches target category, lowercase variant, or 'general' repository files)
    if (queryPlan.category && !relaxCategory) {
        const catArray = Array.isArray(queryPlan.category) ? queryPlan.category : [queryPlan.category];
        const categoryShould = [];
        catArray.forEach(cat => {
            categoryShould.push({ key: "category", match: { value: cat } });
            categoryShould.push({ key: "category", match: { value: String(cat).toLowerCase() } });
        });
        categoryShould.push({ key: "category", match: { value: "general" } });
        must.push({ should: categoryShould });
    }

    // 4. Department filter (Never retrieve unrelated departments when department is known)
    if (queryPlan.department) {
        must.push({
            should: [
                { key: "department", match: { value: queryPlan.department } },
                { key: "departments", match: { value: queryPlan.department } },
                { key: "department", match: { value: "unknown" } },
                { key: "department", match: { value: "" } },
                { key: "department", match: { value: "general" } }
            ]
        });
    }

    // 5. Program / Course filter
    if (queryPlan.program) {
        must.push({
            should: [
                { key: "program", match: { value: queryPlan.program } },
                { key: "course", match: { value: queryPlan.program } },
                { key: "programs", match: { value: queryPlan.program } }
            ]
        });
    }

    // 6. DocumentType filter
    if (queryPlan.documentType && !relaxDocType) {
        must.push({
            should: [
                { key: "documentType", match: { value: queryPlan.documentType } },
                { key: "documentType", match: { value: queryPlan.documentType.toLowerCase() } },
                { key: "documentType", match: { value: "image" } }
            ]
        });
    }

    // 7. Heading filter
    if (queryPlan.heading && !relaxHeading) {
        must.push({
            should: [
                { key: "heading", match: { value: queryPlan.heading } },
                { key: "parentHeading", match: { value: queryPlan.heading } },
                { key: "parentSection", match: { value: queryPlan.heading } },
                { key: "heading", match: { text: queryPlan.heading } }
            ]
        });
    }

    return must.length > 0 ? { must } : undefined;
};

/**
 * Retrieves similar vector matches from Qdrant with payload filtering
 * @param {Object} params
 * @param {Array<number>} params.queryEmbedding - The vector embedding of the user question
 * @param {number} [params.limit=AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT]
 * @param {Object} [params.filter={}] - Metadata filters
 * @param {boolean} [params.isRawFilter=false]
 * @returns {Promise<Array<Object>>} - Retrieved chunks with score and structured metadata
 */
const retrieveRelevantChunks = async ({
    queryEmbedding,
    limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT,
    filter = {},
    isRawFilter = false
}) => {
    const { ensureCollection, formatSearchVector, getVectorFormat } = require("../config/qdrant");
    await ensureCollection().catch(err => {
        console.error("⚠️ Lazy Qdrant collection initialization failed:", err.message);
    });

    const qdrantFilter = isRawFilter ? filter : buildQdrantFilter(filter);
    const smartCacheHub = require("../../services/cache/SmartCacheHub");

    // Check Layer 4 Vector Search Cache
    const cachedVectorSearch = smartCacheHub.l4.getVectorSearch(queryEmbedding, qdrantFilter, limit, collectionName);
    if (cachedVectorSearch && Array.isArray(cachedVectorSearch)) {
        return cachedVectorSearch;
    }

    const vectorParam = await formatSearchVector(queryEmbedding);
    const vectorFmt = await getVectorFormat();
    console.log(`[RAG DIAGNOSTIC: Qdrant Search] Collection: "${collectionName}" | Vector: ${vectorFmt.isNamed ? `named("${vectorFmt.vectorName}")` : "unnamed"} | Dim: ${queryEmbedding.length} | Limit: ${limit} | Filter: ${JSON.stringify(qdrantFilter || null)}`);

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const results = await client.search(collectionName, {
                vector: vectorParam,
                limit,
                filter: qdrantFilter,
                with_payload: true
            });

            if (!Array.isArray(results) || results.length === 0) {
                console.log(`[RAG DIAGNOSTIC: Zero Matches] Qdrant search returned 0 matches for filter: ${JSON.stringify(qdrantFilter || null)}`);
                return [];
            }

            console.log(`[RAG DIAGNOSTIC: Matches Found] Qdrant search returned ${results.length} hit(s). Top score: ${results[0]?.score !== undefined ? results[0].score.toFixed(4) : "N/A"}`);

            const mappedResults = results.map((point) => {
                const payload = point.payload || {};
                const docId = payload.documentId || payload.sourceDocumentId || "";
                const chunkId = payload.chunkId || point.id;

                let content = payload.content || "";
                let localMeta = {};
                if (!content && docId) {
                    const localChunk = localChunkManager.getChunk(docId, chunkId);
                    if (localChunk) {
                        content = localChunk.content || "";
                        localMeta = localChunk.metadata || {};
                    }
                }

                return {
                    id: point.id,
                    content,
                    metadata: {
                        documentId: docId,
                        sourceDocumentId: docId,
                        chunkId,
                        originalName: payload.originalName || localMeta.originalName || payload.filename || "",
                        filename: payload.filename || localMeta.originalName || payload.originalName || "",
                        pageNumber: payload.pageNumber || localMeta.pageNumber || 1,
                        page: payload.pageNumber || localMeta.pageNumber || 1,
                        category: payload.category || localMeta.category || "",
                        department: payload.department || localMeta.department || "",
                        program: payload.program || localMeta.program || "",
                        course: payload.course || payload.program || "",
                        documentType: payload.documentType || localMeta.documentType || "",
                        heading: payload.heading || localMeta.heading || "",
                        parentHeading: payload.parentHeading || localMeta.parentHeading || "",
                        parentSection: payload.parentSection || payload.parentHeading || "",
                        sectionPath: payload.sectionPath || localMeta.sectionPath || "",
                        chunkLevel: payload.chunkLevel || localMeta.chunkLevel || 5,
                        institution: payload.institution || localMeta.institution || "",
                        uploadedBy: payload.uploadedBy || "",
                        chunkIndex: payload.chunkIndex || localMeta.chunkIndex || 0,
                        chunkOrder: payload.chunkOrder || 1,
                        createdAt: payload.createdAt || "",
                        sourceType: payload.sourceType || (payload.uploadedFrom === "crawler" ? "url" : "document"),
                        URL: payload.sourceUrl || "",
                        keywords: payload.keywords || localMeta.keywords || []
                    },
                    score: point.score
                };
            });

            // Cache in Layer 4
            const resultCategories = [...new Set(mappedResults.map(r => r.metadata?.category).filter(Boolean))];
            smartCacheHub.l4.setVectorSearch(queryEmbedding, qdrantFilter, limit, mappedResults, collectionName, resultCategories);

            return mappedResults;
        } catch (e) {
            console.error(`[RAG DIAGNOSTIC: Qdrant Error] Attempt ${attempt} failed: ${e.message}`);
            if (attempt === 1) {
                console.warn(`[Retrieval Service] Transient Qdrant search failure on attempt 1 (${e.message}). Retrying in 300ms...`);
                await new Promise(r => setTimeout(r, 300));
                continue;
            }
            console.error("[Retrieval Service] Qdrant Similarity Search failed after retry:", e.message);
            return [];
        }
    }
    return [];
};

const jaccardDeduplicate = (chunks, threshold = 0.8) => {
    if (!chunks || chunks.length <= 1) return chunks || [];

    const getWordSet = (text) => new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const unique = [];
    const wordSets = [];

    for (const chunk of chunks) {
        const wordSet = getWordSet(chunk.content);
        let isDuplicate = false;

        for (const existingSet of wordSets) {
            let intersection = 0;
            for (const word of wordSet) {
                if (existingSet.has(word)) intersection++;
            }
            const union = wordSet.size + existingSet.size - intersection;
            const similarity = union > 0 ? intersection / union : 0;
            if (similarity > threshold) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            unique.push(chunk);
            wordSets.push(wordSet);
        }
    }

    return unique;
};

/**
 * Resolves Dynamic Top-K retrieval based on query classification.
 * Rules:
 * - Fact question -> 3 chunks
 * - Admission/Fee -> 4 chunks
 * - Faculty list -> 6 chunks
 * - Long course guide -> 8 chunks
 * - Large informational request -> maximum 10 chunks
 */
const resolveDynamicTopK = (question, queryPlan) => {
    const q = String(question || "").toLowerCase();

    // 1. Large informational request (max 10)
    if (
        /\b(?:compare|comparison|versus|vs\.?|difference|handbook|comprehensive|all\s+information|everything\s+about|full\s+overview)\b/i.test(q) ||
        (queryPlan?.queryType === "Comparison" || queryPlan?.queryType === "Summary")
    ) {
        return { topK: 10, rule: "Large informational request (max 10)" };
    }

    // 2. Admission / Fee (4)
    if (
        queryPlan?.intent === "ADMISSION_QUERY" ||
        queryPlan?.intent === "FEE_QUERY" ||
        queryPlan?.category === "Admissions" ||
        queryPlan?.documentType === "Fee Structure" ||
        /\b(?:fee|fees|admission|admissions|tuition|eligibility|charges|cost|application\s+fee|semester\s+fee)\b/i.test(q)
    ) {
        return { topK: 4, rule: "Admission/Fee (4)" };
    }

    // 3. Faculty list (6)
    if (
        /\b(?:faculty\s+list|list\s+of\s+faculty|all\s+professors|all\s+teachers|faculty\s+members|department\s+faculty|professors\s+in|teachers\s+in|faculty\s+directory)\b/i.test(q) ||
        (queryPlan?.intent === "FACULTY_QUERY" && (queryPlan?.queryType === "List" || /\b(?:list|all|directory|members)\b/i.test(q)))
    ) {
        return { topK: 6, rule: "Faculty list (6)" };
    }

    // 4. Long course guide (8)
    if (
        /\b(?:course\s+guide|program\s+guide|curriculum|syllabus|complete\s+bca|full\s+course|complete\s+course|entire\s+course|course\s+structure|subjects\s+list)\b/i.test(q) ||
        (queryPlan?.intent === "SYLLABUS_QUERY" && /\b(?:all|complete|full|entire|overview)\b/i.test(q)) ||
        isCompleteCourseQuery(question, queryPlan)
    ) {
        return { topK: 8, rule: "Long course guide (8)" };
    }

    // 5. Fact question (default: 3)
    return { topK: 3, rule: "Fact question (3)" };
};

/**
 * Signal 1: Semantic Similarity Score (normalized 0..1)
 */
const computeSemanticScore = (rawScore) => {
    const s = Number(rawScore || 0);
    if (isNaN(s)) return 0.5;
    return Math.max(0, Math.min(1, s));
};

/**
 * Signal 2: Keyword Overlap Score (normalized 0..1)
 */
const computeKeywordScore = (query, chunk, queryPlan) => {
    const cleanQuery = String(query || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const words = cleanQuery.split(/\s+/).filter(w => w.length > 2);
    const stopWords = new Set(["what", "is", "the", "for", "tell", "me", "show", "who", "where", "when", "why", "which", "are", "am", "a", "an", "of", "in", "on", "at", "to", "with", "by", "from", "and", "or", "about"]);
    const queryTerms = words.filter(w => !stopWords.has(w));

    if (queryTerms.length === 0) return 0.5;

    const content = String(chunk.content || "").toLowerCase();
    const heading = String(chunk.metadata?.heading || "").toLowerCase();
    const filename = String(chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase();
    const chunkKeywords = Array.isArray(chunk.metadata?.keywords)
        ? chunk.metadata.keywords.map(k => String(k).toLowerCase())
        : [];

    let matchedTerms = 0;
    queryTerms.forEach(term => {
        const matchesContent = content.includes(term) ||
            (term === "hod" && (content.includes("head of department") || heading.includes("head of department"))) ||
            (term === "head" && (content.includes("hod") || heading.includes("hod"))) ||
            (term === "department" && (content.includes("hod") || heading.includes("hod") || filename.includes("department")));
        if (
            matchesContent ||
            heading.includes(term) ||
            filename.includes(term) ||
            chunkKeywords.some(k => k.includes(term))
        ) {
            matchedTerms++;
        }
    });

    const termOverlapRatio = matchedTerms / queryTerms.length;

    // Phrase match bonus
    let phraseBonus = 0;
    if (queryTerms.length >= 2) {
        const fullPhrase = queryTerms.join(" ");
        if (content.includes(fullPhrase)) {
            phraseBonus = 0.20;
        }
    }

    const rawKeywordScore = (termOverlapRatio * 0.80) + phraseBonus;
    return Math.max(0, Math.min(1, rawKeywordScore));
};

/**
 * Signal 3: Metadata Relevance Score (normalized 0..1)
 */
const computeMetadataScore = (queryPlan, chunk) => {
    if (!queryPlan) return 0.5;

    let score = 0;
    let totalWeights = 0;

    const metadata = chunk.metadata || {};
    const chunkCat = String(metadata.category || "").toLowerCase();
    const chunkDept = String(metadata.department || "").toLowerCase();
    const chunkProg = String(metadata.program || metadata.course || "").toLowerCase();
    const chunkDocType = String(metadata.documentType || "").toLowerCase();
    const chunkHeading = String(metadata.heading || metadata.parentSection || "").toLowerCase();
    const filename = String(metadata.originalName || metadata.filename || "").toLowerCase();
    const chunkKeywords = Array.isArray(metadata.keywords)
        ? metadata.keywords.map(k => String(k).toLowerCase())
        : [];

    // Category match
    if (queryPlan.category) {
        totalWeights += 0.25;
        const targetCats = Array.isArray(queryPlan.category)
            ? queryPlan.category.map(c => String(c).toLowerCase())
            : [String(queryPlan.category).toLowerCase()];
        const matchesCategory = targetCats.some(tc =>
            chunkCat === tc || chunkCat.includes(tc) || tc.includes(chunkCat) || chunkCat === "general"
        );
        if (matchesCategory) {
            score += 0.25;
        }
    }

    // Department match
    if (queryPlan.department) {
        totalWeights += 0.30;
        const targetDept = queryPlan.department.toLowerCase();
        const deptsArray = Array.isArray(metadata.departments) ? metadata.departments.map(d => String(d).toLowerCase()) : [];
        const isCssMatch = (targetDept.includes("computational") || targetDept === "css") &&
            (chunkDept.includes("computational") || chunkDept === "css" || deptsArray.includes("css") || filename.includes("computational"));
        if (chunkDept === targetDept || chunkDept.includes(targetDept) || targetDept.includes(chunkDept) || deptsArray.includes(targetDept) || isCssMatch) {
            score += 0.30;
        }
    }

    // Program / Course match
    if (queryPlan.program) {
        totalWeights += 0.25;
        const targetProg = queryPlan.program.toLowerCase();
        const progMatch = chunkProg === targetProg ||
            chunkProg.includes(targetProg) ||
            targetProg.includes(chunkProg) ||
            (metadata.programs && metadata.programs.map(p => String(p).toLowerCase()).includes(targetProg));
        if (progMatch) {
            score += 0.25;
        }
    }

    // DocumentType match
    if (queryPlan.documentType) {
        totalWeights += 0.20;
        if (chunkDocType === queryPlan.documentType.toLowerCase()) {
            score += 0.20;
        }
    }

    // Heading / Section match
    if (queryPlan.heading) {
        totalWeights += 0.25;
        const targetHeading = queryPlan.heading.toLowerCase();
        const contentLower = String(chunk.content || "").toLowerCase();
        const isHodMatch = (targetHeading === "hod" || targetHeading.includes("head")) &&
            (contentLower.includes("hod") || contentLower.includes("head of department") || chunkHeading.includes("hod"));
        if (chunkHeading.includes(targetHeading) || targetHeading.includes(chunkHeading) || isHodMatch) {
            score += 0.25;
        }
    }

    // Planner Keywords match
    if (queryPlan.keywords && queryPlan.keywords.length > 0) {
        totalWeights += 0.15;
        const kwMatches = queryPlan.keywords.filter(k => 
            chunkKeywords.includes(k.toLowerCase()) || chunkHeading.includes(k.toLowerCase()) || chunkCat.includes(k.toLowerCase())
        ).length;
        score += (kwMatches / queryPlan.keywords.length) * 0.15;
    }

    if (totalWeights === 0) return 0.5;
    return Math.max(0, Math.min(1, score / totalWeights));
};

/**
 * Preference for chunks belonging to the same section as the top anchor chunk.
 */
const applySectionPreference = (candidates) => {
    if (!Array.isArray(candidates) || candidates.length <= 1) return candidates;

    // Anchor chunk is the one with highest base combined score
    const anchor = candidates[0];
    const anchorDoc = String(anchor.metadata?.documentId || anchor.metadata?.sourceDocumentId || "");
    const anchorSection = String(anchor.metadata?.parentSection || anchor.metadata?.heading || anchor.metadata?.sectionPath || "").trim().toLowerCase();
    const anchorBaseScore = anchor.baseScore || anchor.score || 0.5;

    candidates.forEach((cand, idx) => {
        let sectionBoost = 0;
        const candDoc = String(cand.metadata?.documentId || cand.metadata?.sourceDocumentId || "");
        const candSection = String(cand.metadata?.parentSection || cand.metadata?.heading || cand.metadata?.sectionPath || "").trim().toLowerCase();

        if (idx > 0 && anchorDoc && candDoc === anchorDoc && anchorSection && candSection) {
            const isSameSection = candSection === anchorSection || candSection.includes(anchorSection) || anchorSection.includes(candSection);
            if (isSameSection) {
                // Same section coherence bonus, capped to not exceed the primary anchor score
                const potentialScore = (cand.baseScore || cand.score || 0.5) + 0.08;
                const cappedScore = Math.min(potentialScore, anchorBaseScore - 0.0001);
                sectionBoost = Math.max(0, parseFloat((cappedScore - (cand.baseScore || cand.score || 0.5)).toFixed(4)));
            }
        }

        cand.rankingSignals = cand.rankingSignals || {};
        cand.rankingSignals.sectionBoost = sectionBoost;
        cand.score = parseFloat(((cand.baseScore || cand.score || 0.5) + sectionBoost).toFixed(4));
        cand.combinedScore = cand.score;
    });

    return candidates;
};

/**
 * Metadata-First Hybrid Retrieval & Ranking Pipeline:
 * User Query -> Query Planner -> Metadata Filter -> Qdrant Semantic Search -> Hybrid Ranking (Semantic + Keyword + Metadata + Section) -> Dynamic Top-K -> Rank Results
 */
const retrieve = async ({ question, user, limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT, ignoreInstitution = false, filter = null }) => {
    const startTime = Date.now();
    let semanticCandidates = [];
    let keywordCandidates = [];

    // 1. Query Planner Execution with Layer 2 Prompt/Query Cache
    const smartCacheHub = require("../../services/cache/SmartCacheHub");
    let queryPlan = smartCacheHub.l2.getQueryPlan(question);
    if (!queryPlan) {
        queryPlan = planQuery(question);
        smartCacheHub.l2.setQueryPlan(question, queryPlan);
    }

    const { topK: dynamicK, rule: topKRule } = resolveDynamicTopK(question, queryPlan);
    console.log(`[RAG PLANNER] Query: "${question}" | Intent: ${queryPlan.intent} | Dynamic Top-K: ${dynamicK} (${topKRule}) | Filters:`, queryPlan.filters);

    // Check Layer 6 Retrieval Cache (10-minute TTL)
    const cacheService = require("../../services/cacheService");
    const userInst = user?.institution || "all";
    const cachedRetrieval = await cacheService.getRetrievalCache(question, queryPlan.filters, userInst, dynamicK);
    if (cachedRetrieval && Array.isArray(cachedRetrieval.candidates) && cachedRetrieval.candidates.length > 0) {
        const cachedCandidates = cachedRetrieval.candidates;
        const latencyMs = Date.now() - startTime;
        cachedCandidates.statistics = {
            matchedChunks: cachedCandidates.length,
            filteredChunks: cachedRetrieval.retrievedChunkIds?.length || cachedCandidates.length,
            latency: latencyMs,
            latencyMs: latencyMs,
            topKRule,
            targetTopK: dynamicK,
            filtersApplied: queryPlan.filters,
            queryPlan,
            cached: true
        };
        cachedCandidates.retrievalTelemetry = {
            ...cachedCandidates.statistics,
            queryMode: detectQueryMode(question),
            totalTokens: 0
        };
        return cachedCandidates;
    }

    let expandedQuestion = question;
    if (/\bcss\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion + " computational sciences";
    }
    if (/\bhod\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion + " head of department";
    } else if (/\bhead of department\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion + " hod";
    }

    const completeCourseQuery = isCompleteCourseQuery(question, queryPlan);
    if (completeCourseQuery) {
        expandedQuestion = expandedQuestion + " " + COURSE_INFORMATION_TERMS.join(" ");
    }

    const queryMode = detectQueryMode(expandedQuestion);
    let currentFetchK = Math.max(dynamicK * 8, 30);
    if (completeCourseQuery) currentFetchK = Math.max(currentFetchK, 32);

    let usedFilter = undefined;
    let filteredCount = 0;

    // 2. Metadata-First Qdrant Vector Search (Guarded by fast availability check)
    const { isQdrantAvailable } = require("../config/qdrant");
    const qdrantIsUp = await isQdrantAvailable(400);

    if (qdrantIsUp) {
        try {
            const queryEmbedding = await embeddingService.getQueryEmbedding(expandedQuestion);

            // Build strict metadata filter first
            const strictFilter = buildPlannerQdrantFilter({
                queryPlan,
                user,
                ignoreInstitution,
                filter
            });

            usedFilter = strictFilter;
            console.log(`[RAG DEBUG] Executing Metadata-Filtered Qdrant search. Filter:`, JSON.stringify(strictFilter));

            semanticCandidates = await retrieveRelevantChunks({
                queryEmbedding,
                limit: currentFetchK,
                filter: strictFilter,
                isRawFilter: true
            });

            // Controlled relaxation: If strict filter yields 0 results, relax heading/docType/category while preserving department & program
            if (semanticCandidates.length === 0 && (queryPlan.heading || queryPlan.documentType || queryPlan.category)) {
                console.log(`[RAG DIAGNOSTIC: Fallback Retrieval] Strict filter returned 0 results. Relaxing heading/docType/category constraints.`);
                const relaxedFilter = buildPlannerQdrantFilter({
                    queryPlan,
                    user,
                    ignoreInstitution,
                    filter,
                    relaxHeading: true,
                    relaxDocType: true,
                    relaxCategory: true
                });
                usedFilter = relaxedFilter;
                semanticCandidates = await retrieveRelevantChunks({
                    queryEmbedding,
                    limit: currentFetchK,
                    filter: relaxedFilter,
                    isRawFilter: true
                });
            }

            // Final semantic fallback: If filtered search still returns 0 results, search Qdrant by pure embedding similarity
            if (semanticCandidates.length === 0) {
                console.log(`[RAG DIAGNOSTIC: Fallback Retrieval] Filtered search returned 0 results. Falling back to pure semantic similarity vector search.`);
                semanticCandidates = await retrieveRelevantChunks({
                    queryEmbedding,
                    limit: currentFetchK,
                    filter: (user?.institution && !ignoreInstitution && user.institution !== "all") ? {
                        should: [
                            { key: "institution", match: { value: user.institution } },
                            { key: "institution", match: { value: "all" } },
                            { key: "institution", match: { value: "general" } },
                            { key: "institution", match: { value: "" } }
                        ]
                    } : {},
                    isRawFilter: true
                });
            }
        } catch (vectorErr) {
            console.error(`[RAG DIAGNOSTIC: Qdrant Error] Semantic retrieval failed: ${vectorErr.message}`);
        }
    } else {
        console.warn("[RAG DIAGNOSTIC: Fallback Retrieval] Qdrant is currently offline/unavailable (circuit breaker or probe failed). Falling back to local high-precision knowledge search.");
    }

    // 3. Local Chunk Keyword & Semantic Search restricted to same metadata constraints
    try {
        const localSearchFilters = {
            category: queryPlan.category || filter?.category,
            department: queryPlan.department || filter?.department,
            program: queryPlan.program || filter?.program,
            documentType: queryPlan.documentType || filter?.documentType,
            institution: (user?.institution && !ignoreInstitution) ? user.institution : "all"
        };

        keywordCandidates = localChunkManager.searchLocalChunks(
            expandedQuestion,
            localSearchFilters,
            currentFetchK
        );
        console.log(`[Retrieval Service] Local chunk search returned ${keywordCandidates.length} candidate chunks.`);
    } catch (searchErr) {
        console.error("[Retrieval Service] Local chunk search warning:", searchErr.message);
    }

    // 4. Multi-tier Deduplication
    const rawPool = [...semanticCandidates, ...keywordCandidates];
    filteredCount = rawPool.length;

    const seenIds = new Set();
    const seenSignatures = new Set();
    const uniquePool = [];

    for (const cand of rawPool) {
        const chunkId = String(cand.id || cand.metadata?.chunkId || "");
        const sig = `${cand.metadata?.documentId || cand.metadata?.sourceDocumentId}_${cand.content.trim().slice(0, 80)}`;

        if (chunkId && seenIds.has(chunkId)) continue;
        if (seenSignatures.has(sig)) continue;

        if (chunkId) seenIds.add(chunkId);
        seenSignatures.add(sig);
        uniquePool.push(cand);
    }

    // Jaccard similarity deduplication (threshold = 0.80)
    const deduplicated = jaccardDeduplicate(uniquePool, 0.80);

    // 5. Compute Combined Score across 3 Ranking Signals + Section Preference
    // Signal 1: Semantic similarity from Qdrant
    // Signal 2: Keyword overlap
    // Signal 3: Metadata relevance
    const scoredPool = deduplicated.map(chunk => {
        const semanticScore = computeSemanticScore(chunk.score);
        const keywordScore = computeKeywordScore(question, chunk, queryPlan);
        const metadataScore = computeMetadataScore(queryPlan, chunk);

        // Weighted combination: 45% semantic, 25% keyword, 25% metadata
        const baseScore = (0.45 * semanticScore) + (0.25 * keywordScore) + (0.25 * metadataScore);

        return {
            ...chunk,
            baseScore: parseFloat(baseScore.toFixed(4)),
            score: parseFloat(baseScore.toFixed(4)),
            rankingSignals: {
                semanticScore: parseFloat(semanticScore.toFixed(4)),
                keywordScore: parseFloat(keywordScore.toFixed(4)),
                metadataScore: parseFloat(metadataScore.toFixed(4)),
                sectionBoost: 0
            }
        };
    });

    // Sort by base score before applying section boost
    scoredPool.sort((a, b) => b.baseScore - a.baseScore);

    // Prefer chunks from the same section (Section Coherence Boosting)
    const sectionBoosted = applySectionPreference(scoredPool);

    // Sort results by final combined relevance score
    sectionBoosted.sort((a, b) => b.score - a.score);

    // 6. Dynamic Top-K Slicing and Token Budget Filtering
    let totalTokens = 0;
    const finalCandidates = [];
    const targetTopK = dynamicK;
    const maxContextTokens = Number(process.env.RAG_MAX_CONTEXT_TOKENS) || 4000;

    for (const cand of sectionBoosted) {
        const tokens = countTokens(cand.content);
        if (finalCandidates.length >= targetTopK || (totalTokens + tokens > maxContextTokens && finalCandidates.length > 0)) {
            break;
        }
        finalCandidates.push(cand);
        totalTokens += tokens;
    }

    const latencyMs = Date.now() - startTime;

    // 7. Attach Retrieval Statistics & Telemetry
    finalCandidates.statistics = {
        matchedChunks: finalCandidates.length,
        filteredChunks: filteredCount,
        latency: latencyMs,
        latencyMs: latencyMs,
        topKRule,
        targetTopK,
        filtersApplied: queryPlan.filters,
        queryPlan
    };

    finalCandidates.retrievalTelemetry = {
        ...finalCandidates.statistics,
        queryMode,
        totalTokens
    };

    console.log(`[Retrieval Stats] Matched: ${finalCandidates.length} | Top-K Rule: "${topKRule}" | Filtered: ${filteredCount} | Latency: ${latencyMs}ms | Filters:`, queryPlan.filters);

    // Cache retrieval candidates for identical queries (10-minute TTL)
    if (finalCandidates.length > 0) {
        const categories = queryPlan.category ? [queryPlan.category] : [];
        cacheService.setRetrievalCache(question, queryPlan.filters, finalCandidates, categories, userInst, dynamicK).catch(() => {});
    }

    return finalCandidates;
};

module.exports = {
    buildPlannerQdrantFilter,
    retrieveRelevantChunks,
    resolveDynamicTopK,
    computeSemanticScore,
    computeKeywordScore,
    computeMetadataScore,
    applySectionPreference,
    retrieve
};
