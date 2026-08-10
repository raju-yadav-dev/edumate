const { client, collectionName } = require("../config/qdrant");
const AI_CONSTANTS = require("../constants/aiConstants");

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
        const qdrantFilter = isRawFilter ? filter : buildQdrantFilter(filter);

        const results = await client.search(collectionName, {
            vector: queryEmbedding,
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
const retrieve = async ({ question, user, limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT, ignoreInstitution = false }) => {
    let candidates = [];

    // Expand "CSS" or "css" (Computational Sciences) and department abbreviations for better matching
    let expandedQuestion = question;
    if (/\bcss\b/i.test(expandedQuestion)) {
        expandedQuestion = expandedQuestion.replace(/\bcss\b/gi, "computational sciences");
    }

    console.log(`[RAG DEBUG] User query: "${question}"`);
    if (expandedQuestion !== question) {
        console.log(`[RAG DEBUG] Expanded query: "${expandedQuestion}"`);
    }

    // 1. Vector Search
    const queryEmbedding = await embeddingService.getQueryEmbedding(expandedQuestion);
    
    // Construct robust Qdrant nested filter
    const must = [];
    if (user?.institution && !ignoreInstitution) {
        must.push({
            should: [
                { key: "institution", match: { value: user.institution } },
                { key: "institution", match: { value: "all" } },
                { key: "institution", match: { value: "general" } },
                { key: "institution", match: { value: "" } }
            ]
        });
    }
    if (user?.department && !ignoreInstitution) {
        must.push({
            should: [
                { key: "department", match: { value: user.department } },
                { key: "department", match: { value: "all" } },
                { key: "department", match: { value: "general" } },
                { key: "department", match: { value: "academic" } },
                { key: "department", match: { value: "" } }
            ]
        });
    }

    const qdrantFilter = must.length > 0 ? { must } : undefined;
    candidates = await retrieveRelevantChunks({ queryEmbedding, limit, filter: qdrantFilter, isRawFilter: true });

    // 2. Keyword/Lexical Fallback
    if (candidates.length < Math.min(limit, 3)) {
        console.log("[Retrieval Service] Running MongoDB keyword search fallback...");
        try {
            const cleanQuery = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 1);
            const stopWords = new Set(["give", "details", "about", "what", "is", "the", "for", "tell", "me", "show", "how", "course", "program", "programme"]);
            const keywords = words.filter(w => !stopWords.has(w));

            // Domain term expansion: For BCA faculty queries, include Computational Sciences
            if (cleanQuery.includes("faculty") || cleanQuery.includes("faculties")) {
                if (cleanQuery.includes("bca") || cleanQuery.includes("computational") || cleanQuery.includes("computer")) {
                    if (!keywords.includes("computational")) keywords.push("computational");
                    if (!keywords.includes("sciences")) keywords.push("sciences");
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
                        "metadata.institution": { $in: [user.institution, "all", "general", ""] }
                    });
                }

                const mongoQuery = { $and: mustConditions };

                const matchedChunks = await Chunk.find(mongoQuery).limit(limit).lean();

                const fallbackCandidates = matchedChunks.map(c => ({
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
                        uploadedBy: c.metadata?.uploadedBy || "",
                        chunkIndex: c.metadata?.chunkIndex || 0,
                        createdAt: c.createdAt || "",
                        sourceType: "document",
                        URL: ""
                    },
                    score: 0.85 // High baseline for direct keyword hits
                }));

                const candidateIds = new Set(candidates.map(c => c.id));
                fallbackCandidates.forEach(fc => {
                    if (!candidateIds.has(fc.id)) {
                        candidates.push(fc);
                    }
                });
            }
        } catch (mongoSearchError) {
            console.error("[Retrieval Service] MongoDB keyword fallback failed:", mongoSearchError.message);
        }
    }

    return candidates;
};

module.exports = {
    retrieveRelevantChunks,
    retrieve
};
