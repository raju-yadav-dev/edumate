const { client, collectionName, vectorName } = require("../config/qdrant");
const AI_CONSTANTS = require("../constants/aiConstants");
const { detectTypeAndDepartment } = require("../utils/queryParser");

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
 * Retrieves similar vector matches from the Qdrant database
 * @param {Object} params
 * @param {Array<number>} params.queryEmbedding - The vector embedding of the user question
 * @param {number} [params.limit=AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT]
 * @param {Object} [params.filter={}] - Metadata filters (department, category, institution, documentId)
 * @returns {Promise<Array<Object>>} - Retrieved chunks with score and structured metadata
 */
const retrieveRelevantChunks = async ({
    queryEmbedding,
    limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT,
    filter = {},
    isRawFilter = false
}) => {
    try {
        const { ensureCollection } = require("../config/qdrant");
        await ensureCollection().catch(err => {
            console.error("⚠️ Lazy Qdrant collection initialization failed:", err.message);
        });

        const qdrantFilter = isRawFilter ? filter : buildQdrantFilter(filter);

        const results = await client.search(collectionName, {
            vector: {
                name: vectorName || "default",
                vector: queryEmbedding
            },
            limit,
            filter: qdrantFilter,
            with_payload: true
        });

        // Detailed RAG debug logging for Qdrant retrieval
        console.log("\n[RAG DEBUG] ==================== QDRANT RETRIEVAL ====================");
        console.log(`[RAG DEBUG] Query embedding dimension: ${queryEmbedding ? queryEmbedding.length : "N/A"}`);
        console.log(`[RAG DEBUG] Qdrant top 10 results:`);
        if (Array.isArray(results)) {
            results.slice(0, 10).forEach((point, idx) => {
                const payload = point.payload || {};
                console.log(`  [Result ${idx + 1}]`);
                console.log(`    similarity score : ${point.score}`);
                console.log(`    documentId       : ${payload.documentId}`);
                console.log(`    filename         : ${payload.originalName || payload.filename || "N/A"}`);
                console.log(`    chunkId          : ${point.id}`);
                console.log(`    chunk text       : ${payload.content ? payload.content.replace(/\n/g, " ").slice(0, 200) : "N/A"}...`);
                console.log(`    metadata/source  : ${JSON.stringify(payload)}`);
            });
        } else {
            console.log("  No results returned or results is not an array.");
        }
        console.log("[RAG DEBUG] ==========================================================\n");

        if (!Array.isArray(results) || results.length === 0) {
            return [];
        }

        return results.map((point) => {
            const payload = point.payload || {};
            return {
                id: point.id,
                content: payload.content || "",
                metadata: {
                    documentId: payload.documentId || "",
                    originalName: payload.originalName || "",
                    filename: payload.originalName || "",
                    pageNumber: payload.pageNumber || 1,
                    page: payload.pageNumber || 1,
                    category: payload.category || "",
                    department: payload.department || "",
                    institution: payload.institution || "",
                    uploadedBy: payload.uploadedBy || "",
                    chunkIndex: payload.chunkIndex || 0,
                    createdAt: payload.createdAt || "",
                    sourceType: payload.sourceType || (payload.uploadedFrom === "crawler" ? "url" : "document"),
                    URL: payload.sourceUrl || ""
                },
                score: point.score // Qdrant cosine similarity score
            };
        });
    } catch (e) {
        console.error("Qdrant Similarity Search failed:", e.message);
        return [];
    }
};

const embeddingService = require("./embeddingService");

const Chunk = require("../../models/Chunk");

/**
 * High-level coordinate retrieval function that handles query embedding and user filters
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.user
 * @param {number} [params.limit=AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT]
 * @returns {Promise<Array<Object>>}
 */
const evaluateRetrievalCoverage = ({ chunks, mode, currentK, maxK }) => {
    if (currentK >= maxK) {
        return { shouldExpand: false, reason: "Max K limit reached" };
    }
    if (chunks.length === 0) {
        return { shouldExpand: false, reason: "No chunks found" };
    }

    const topScore = Math.max(...chunks.map(c => c.score));
    
    // If the top score is extremely low, do not expand further (no useful semantic signals)
    if (topScore < 0.35) {
        return { shouldExpand: false, reason: "Relevance score too low" };
    }

    // Filter chunks with reasonable similarity (relevance threshold)
    const relevantChunks = chunks.filter(c => c.score >= 0.40);
    if (relevantChunks.length === 0) {
        return { shouldExpand: false, reason: "No relevant chunks above threshold" };
    }

    // 1. TARGETED queries
    if (mode === "TARGETED") {
        const strongMatches = chunks.filter(c => c.score >= 0.60);
        if (strongMatches.length >= 1 || relevantChunks.length >= 3) {
            return { shouldExpand: false, reason: "Targeted query sufficiently answered by strong matches" };
        }
    }

    // 2. EXPLANATION / MULTI_PART queries
    if (mode === "EXPLANATION" || mode === "MULTI_PART") {
        if (relevantChunks.length >= currentK) {
            const docIds = new Set(relevantChunks.map(c => c.metadata?.documentId));
            if (docIds.size === 1 && relevantChunks.length >= 4) {
                return { shouldExpand: false, reason: "Explanation query covered by a single document" };
            }
        }
    }

    // 3. COMPREHENSIVE_LIST / COMPLETE_DATASET
    if (mode === "COMPREHENSIVE_LIST" || mode === "COMPLETE_DATASET") {
        const lowestScore = chunks[chunks.length - 1]?.score || 0;
        if (lowestScore < 0.45) {
            return { shouldExpand: false, reason: "Comprehensive list coverage limit reached (relevance tail dropped)" };
        }
        return { shouldExpand: true, reason: "Comprehensive list requires maximum coverage" };
    }

    if (chunks.length < currentK) {
        return { shouldExpand: false, reason: "No more matches available in database" };
    }

    return { shouldExpand: true, reason: "Default expansion criteria" };
};

const jaccardDeduplicate = (chunks) => {
    const getWordSet = (text) => new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2));
    
    const unique = [];
    const wordSets = [];

    for (const chunk of chunks) {
        const wordSet = getWordSet(chunk.content);
        let isDuplicate = false;

        for (let i = 0; i < unique.length; i++) {
            const existingSet = wordSets[i];
            
            let intersectionSize = 0;
            for (const word of wordSet) {
                if (existingSet.has(word)) {
                    intersectionSize++;
                }
            }
            const unionSize = wordSet.size + existingSet.size - intersectionSize;
            const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

            if (jaccard >= 0.70) {
                isDuplicate = true;
                if (chunk.score > unique[i].score) {
                    unique[i] = chunk;
                    wordSets[i] = wordSet;
                }
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

const retrieve = async ({ question, user, limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT, ignoreInstitution = false, filter = null }) => {
    let semanticCandidates = [];
    let keywordCandidates = [];

    let expandedQuestion = question;
    if (/\bcss\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion.replace(/\bcss\b/gi, "computational sciences");
    }

    console.log(`[RAG DEBUG] User query: "${question}"`);
    if (expandedQuestion !== question) {
        console.log(`[RAG DEBUG] Expanded query: "${expandedQuestion}"`);
    }

    const { documentType: detectedType, department: detectedDept } = detectTypeAndDepartment(expandedQuestion);
    console.log(`[RAG DEBUG] Query Analysis - Detected Type: "${detectedType || 'none'}", Detected Dept: "${detectedDept || 'none'}"`);

    const { detectQueryMode } = require("../utils/queryParser");
    const queryMode = detectQueryMode(expandedQuestion);
    console.log(`[RAG DEBUG] Query Analysis - Detected Retrieval Mode: "${queryMode}"`);

    const initialKTargeted = Number(process.env.RAG_INITIAL_K_TARGETED) || 3;
    const initialKExplanation = Number(process.env.RAG_INITIAL_K_EXPLANATION) || 5;
    const initialKList = Number(process.env.RAG_INITIAL_K_LIST) || 8;
    const maxK = Number(process.env.RAG_MAX_K) || 15;

    let initialK = initialKTargeted;
    if (queryMode === "EXPLANATION" || queryMode === "MULTI_PART") {
        initialK = initialKExplanation;
    } else if (queryMode === "COMPREHENSIVE_LIST" || queryMode === "COMPLETE_DATASET") {
        initialK = initialKList;
    }

    let currentK = Math.min(limit, maxK);
    let attemptsCount = 1;
    let usedType = undefined;
    let usedDept = undefined;
    let usedFilter = undefined;

    try {
        const queryEmbedding = await embeddingService.getQueryEmbedding(expandedQuestion);
        
        const baseMust = [];
        if (user?.institution && user.institution !== "all" && !ignoreInstitution) {
            baseMust.push({
                should: [
                    { key: "institution", match: { value: user.institution } },
                    { key: "institution", match: { value: "all" } },
                    { key: "institution", match: { value: "general" } },
                    { key: "institution", match: { value: "" } }
                ]
            });
        }
        if (filter && filter.sourceType) {
            baseMust.push({ key: "sourceType", match: { value: filter.sourceType } });
        }

        console.log(`[RAG DEBUG] Executing single global vector search (Limit: ${currentK})`);
        const qdrantFilter = baseMust.length > 0 ? { must: baseMust } : undefined;
        usedFilter = qdrantFilter;

        semanticCandidates = await retrieveRelevantChunks({ 
            queryEmbedding, 
            limit: currentK, 
            filter: qdrantFilter, 
            isRawFilter: true 
        });

    } catch (vectorErr) {
        console.error("[Retrieval Service] Semantic search failed:", vectorErr.message);
    }

    try {
        const cleanQuery = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
        const words = cleanQuery.split(/\s+/).filter(w => w.length > 1);
        
        const stopWords = new Set([
            "give", "details", "about", "what", "is", "the", "for", "tell", "me", "show", 
            "how", "course", "program", "programme", "who", "where", "when", "why", "which",
            "are", "am", "a", "an", "of", "in", "on", "at", "to", "with", "by", "from", 
            "and", "or", "but", "about", "us", "you", "he", "she", "they", "them", "i", 
            "we", "our", "their", "his", "her", "it", "its", "does", "do", "did", "has", "have", "had"
        ]);
        let keywords = words.filter(w => !stopWords.has(w));

        if (cleanQuery.includes("faculty") || cleanQuery.includes("faculties") || cleanQuery.includes("teacher") || cleanQuery.includes("professor") || cleanQuery.includes("hod")) {
            if (cleanQuery.includes("bca") || cleanQuery.includes("computational") || cleanQuery.includes("computer") || cleanQuery.includes("css")) {
                if (!keywords.includes("computational")) keywords.push("computational");
                if (!keywords.includes("sciences")) keywords.push("sciences");
                if (!keywords.includes("faculty")) keywords.push("faculty");
            }
        }

        if (keywords.length > 0) {
            const regexes = keywords.map(kw => {
                const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                return new RegExp(`\\b${escaped}\\b`, "i");
            });

            const mustConditions = [
                { $or: regexes.map(r => ({ content: r })) }
            ];

            if (user?.institution && !ignoreInstitution) {
                mustConditions.push({
                    "metadata.institution": { $in: [user.institution, "all", "general", "", null] }
                });
            }

            if (filter && filter.sourceType) {
                mustConditions.push({
                    "metadata.sourceType": filter.sourceType
                });
            }

            if (usedType) {
                mustConditions.push({
                    $or: [
                        { "metadata.category": usedType },
                        { "metadata.documentType": usedType }
                    ]
                });
            }
            if (usedDept) {
                mustConditions.push({ "metadata.department": usedDept });
            }

            const mongoQuery = { $and: mustConditions };
            const matchedChunks = await Chunk.find(mongoQuery).limit(50).lean();

            keywordCandidates = matchedChunks.map(c => {
                let matches = 0;
                const contentLower = c.content.toLowerCase();
                keywords.forEach(kw => {
                    if (contentLower.includes(kw)) {
                        matches++;
                    }
                });
                const densityScore = matches / keywords.length;
                const score = 0.35 + (densityScore * 0.15);

                return {
                    id: c._id.toString(),
                    content: c.content,
                    metadata: {
                        documentId: c.document?.toString() || "",
                        originalName: c.metadata?.originalName || "",
                        filename: c.metadata?.originalName || "",
                        pageNumber: c.metadata?.pageNumber || 1,
                        page: c.metadata?.pageNumber || 1,
                        category: c.metadata?.category || "",
                        department: c.metadata?.department || "",
                        institution: c.metadata?.institution || "",
                        university: c.metadata?.institution || "",
                        uploadedBy: c.metadata?.uploadedBy || "",
                        chunkIndex: c.metadata?.chunkIndex || 0,
                        createdAt: c.createdAt || "",
                        sourceType: "document",
                        URL: ""
                    },
                    score
                };
            });

            keywordCandidates.sort((a, b) => b.score - a.score);
        }
    } catch (mongoSearchError) {
        console.error("[Retrieval Service] MongoDB keyword search failed:", mongoSearchError.message);
    }

    const combined = [...semanticCandidates, ...keywordCandidates];
    const seen = new Set();
    const uniqueCandidates = [];

    for (const cand of combined) {
        const contentSig = `${cand.metadata?.documentId}_${cand.content.trim().slice(0, 100)}`;
        if (!seen.has(contentSig)) {
            seen.add(contentSig);
            if (cand.metadata) {
                cand.metadata.university = cand.metadata.institution || cand.metadata.university || "";
                cand.metadata.filename = cand.metadata.filename || cand.metadata.originalName || "";
            }
            uniqueCandidates.push(cand);
        } else {
            const existing = uniqueCandidates.find(c => `${c.metadata?.documentId}_${c.content.trim().slice(0, 100)}` === contentSig);
            if (existing && cand.score > existing.score) {
                existing.score = cand.score;
                if (cand.initialScore) existing.initialScore = cand.initialScore;
            }
        }
    }

    const deduplicated = jaccardDeduplicate(uniqueCandidates);
    deduplicated.sort((a, b) => b.score - a.score);

    const { countTokens } = require("../utils/tokenizer");
    let totalTokens = 0;
    const finalCandidates = [];
    const maxContextChunks = Number(process.env.RAG_MAX_CONTEXT_CHUNKS) || 15;
    const maxContextTokens = Number(process.env.RAG_MAX_CONTEXT_TOKENS) || 4000;

    for (const cand of deduplicated) {
        const tokens = countTokens(cand.content);
        if (totalTokens + tokens > maxContextTokens) {
            console.log(`[Retrieval] Context budget limit reached (Tokens: ${totalTokens}, next chunk size: ${tokens} exceeds ${maxContextTokens})`);
            break;
        }
        if (finalCandidates.length >= maxContextChunks) {
            console.log(`[Retrieval] Context budget reached (Max chunks limit: ${maxContextChunks})`);
            break;
        }
        finalCandidates.push(cand);
        totalTokens += tokens;
    }

    finalCandidates.resolvedType = usedType;
    finalCandidates.resolvedDept = usedDept;
    finalCandidates.retrievalTelemetry = {
        queryMode,
        initialK,
        finalK: currentK,
        totalAttempts: attemptsCount,
        candidatesBeforeDedup: combined.length,
        candidatesAfterDedup: deduplicated.length,
        finalCandidatesCount: finalCandidates.length,
        finalTokens: totalTokens
    };

    console.log(`[Retrieval Telemetry] Mode: ${queryMode} | Initial K: ${initialK} | Final K: ${currentK} | Unique Chunks: ${finalCandidates.length} | Tokens: ${totalTokens}`);

    return finalCandidates;
};

module.exports = {
    retrieveRelevantChunks,
    retrieve
};
