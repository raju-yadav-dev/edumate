const embeddings = require("../ai/config/embeddings");

/**
 * Generates vector embedding for a single text using configured embedding provider
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("Text must be a non-empty string.");
    }
    return embeddings.embedText(text);
};

/**
 * Generates vector embeddings for a batch of texts using configured embedding provider
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts) => {
    return embeddings.embedTexts(texts);
};

module.exports = {
    generateEmbedding,
    generateEmbeddingsBatch
};
