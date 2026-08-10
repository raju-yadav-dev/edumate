const embeddings = require("../config/embeddings");

/**
 * Generates an embedding for a user's question query
 * @param {string} question
 * @returns {Promise<Array<number>>}
 */
const getQueryEmbedding = async (question) => {
    if (!question || typeof question !== "string") {
        throw new Error("Query text is required to generate embedding.");
    }
    return embeddings.embedText(question, { task: "retrieval.query" });
};

/**
 * Generates embeddings for a batch of text chunks
 * @param {Array<string>} chunks
 * @returns {Promise<Array<Array<number>>>}
 */
const getChunksEmbeddings = async (chunks) => {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return [];
    }
    return embeddings.embedTexts(chunks, { task: "retrieval.passage" });
};

module.exports = {
    getQueryEmbedding,
    getChunksEmbeddings
};
