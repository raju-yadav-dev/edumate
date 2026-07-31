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
                    pageNumber: payload.pageNumber || 1,
                    category: payload.category || "",
                    department: payload.department || "",
                    institution: payload.institution || "",
                    uploadedBy: payload.uploadedBy || "",
                    chunkIndex: payload.chunkIndex || 0,
                    createdAt: payload.createdAt || ""
                },
                score: point.score // Qdrant cosine similarity score (typically between -1 and 1, or 0 and 1)
            };
        });
    } catch (e) {
        console.error("Qdrant Similarity Search failed:", e.message);
        return [];
    }
};

const embeddingService = require("./embeddingService");

/**
 * High-level coordinate retrieval function that handles query embedding and user filters
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.user
 * @param {number} [params.limit=AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT]
 * @returns {Promise<Array<Object>>}
 */
const retrieve = async ({ question, user, limit = AI_CONSTANTS.DEFAULT_RETRIEVAL_LIMIT }) => {
    const queryEmbedding = await embeddingService.getQueryEmbedding(question);
    
    // Construct robust Qdrant nested filter
    const must = [];

    // Match user's institution OR general/empty values
    if (user?.institution) {
        must.push({
            should: [
                { key: "institution", match: { value: user.institution } },
                { key: "institution", match: { value: "all" } },
                { key: "institution", match: { value: "general" } },
                { key: "institution", match: { value: "" } }
            ]
        });
    }

    // Match user's department OR general/empty values (essential for university-wide prospectus/admission docs)
    if (user?.department) {
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

    return retrieveRelevantChunks({ queryEmbedding, limit, filter: qdrantFilter, isRawFilter: true });
};

module.exports = {
    retrieveRelevantChunks,
    retrieve
};
