const Chunk = require("../models/Chunk");

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
 * Deletes and saves new chunks for a document
 * @param {string} documentId
 * @param {Array<Object>} chunks
 * @returns {Promise<Array>}
 */
const saveChunks = async (documentId, chunks) => {
    await deleteChunks(documentId);

    if (chunks.length === 0) {
        return [];
    }

    const chunkDocs = chunks.map((chunk) => ({
        document: documentId,
        content: chunk.content,
        embedding: chunk.embedding,
        metadata: {
            pageNumber: chunk.metadata.pageNumber || 1,
            originalName: chunk.metadata.originalName || "",
            category: chunk.metadata.category || "",
            institution: chunk.metadata.institution || "",
            department: chunk.metadata.department || ""
        }
    }));

    return Chunk.insertMany(chunkDocs);
};

/**
 * Deletes all chunks associated with a document
 * @param {string} documentId
 * @returns {Promise<Object>}
 */
const deleteChunks = async (documentId) => {
    return Chunk.deleteMany({ document: documentId });
};

/**
 * Performs cosine similarity search over MongoDB document chunks
 * @param {Object} params
 * @param {Array<number>} params.queryEmbedding - The vector embedding of the user's query
 * @param {number} [params.limit=5] - Maximum number of chunks to return
 * @param {Object} [params.filter={}] - Metadata filters (institution, category, department)
 * @returns {Promise<Array<Object>>}
 */
const similaritySearch = async ({ queryEmbedding, limit = 5, filter = {} }) => {
    const query = {};

    if (filter.institution) {
        query["metadata.institution"] = filter.institution;
    }
    if (filter.category) {
        query["metadata.category"] = filter.category;
    }
    if (filter.department) {
        query["metadata.department"] = filter.department;
    }

    // Retrieve candidates from database
    const candidates = await Chunk.find(query).lean();

    if (candidates.length === 0) {
        return [];
    }

    // Calculate similarity score for each candidate chunk
    const scored = candidates.map((candidate) => {
        const score = cosineSimilarity(queryEmbedding, candidate.embedding);
        return {
            ...candidate,
            score
        };
    });

    // Sort by descending score
    scored.sort((a, b) => b.score - a.score);

    // Return top limit
    return scored.slice(0, limit);
};

module.exports = {
    saveChunks,
    deleteChunks,
    similaritySearch
};
