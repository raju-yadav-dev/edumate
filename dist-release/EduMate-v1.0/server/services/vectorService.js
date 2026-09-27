const localChunkManager = require("../storage/localChunkManager");

/**
 * Computes the cosine similarity between two vector arrays
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number} - Cosine similarity score between -1 and 1
 */
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Deletes and saves new chunks for a document in local storage
 * @param {string} documentId
 * @param {Array<Object>} chunks
 * @returns {Promise<Array>}
 */
const saveChunks = async (documentId, chunks) => {
    if (!chunks || chunks.length === 0) {
        await deleteChunks(documentId);
        return [];
    }

    const chunkDocs = chunks.map((chunk, index) => ({
        chunkId: chunk.chunkId || `${documentId}_chunk_${index + 1}`,
        documentId: String(documentId),
        content: chunk.content || chunk.text || "",
        cleanedText: chunk.cleanedText || chunk.content || "",
        pageNumber: chunk.metadata?.pageNumber || chunk.pageNumber || 1,
        page: chunk.metadata?.pageNumber || chunk.pageNumber || 1,
        heading: chunk.metadata?.heading || chunk.heading || "",
        section: chunk.metadata?.section || chunk.section || "",
        keywords: chunk.metadata?.keywords || chunk.keywords || [],
        hierarchy: chunk.metadata?.hierarchy || chunk.hierarchy || {},
        embedding: chunk.embedding || [],
        metadata: {
            pageNumber: chunk.metadata?.pageNumber || 1,
            originalName: chunk.metadata?.originalName || "",
            category: chunk.metadata?.category || "",
            institution: chunk.metadata?.institution || "",
            department: chunk.metadata?.department || ""
        }
    }));

    return localChunkManager.replaceDocumentChunks(documentId, chunkDocs);
};

/**
 * Deletes all chunks associated with a document from local storage
 * @param {string} documentId
 * @returns {Promise<Object>}
 */
const deleteChunks = async (documentId) => {
    const deleted = await localChunkManager.deleteDocumentChunks(documentId);
    return { acknowledged: true, deletedCount: deleted ? 1 : 0 };
};

/**
 * Fallback similarity search using local chunk storage
 * @param {Object} params
 * @param {Array<number>} params.queryEmbedding - The vector embedding of the user's query
 * @param {number} [params.limit=5] - Maximum number of chunks to return
 * @param {Object} [params.filter={}] - Metadata filters (institution, category, department)
 * @returns {Promise<Array<Object>>}
 */
const similaritySearch = async ({ queryEmbedding, limit = 5, filter = {} }) => {
    // Note: Primary retrieval is handled through Qdrant vector index + localChunkManager lookup.
    return [];
};

module.exports = {
    cosineSimilarity,
    saveChunks,
    deleteChunks,
    similaritySearch
};
