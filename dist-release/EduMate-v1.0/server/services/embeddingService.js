const embeddings = require("../ai/config/embeddings");

/**
 * Generates vector embedding for a single text using configured embedding provider
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text, options = {}) => {
    if (!text || typeof text !== "string") {
        throw new Error("Text must be a non-empty string.");
    }
    return embeddings.embedText(text, options);
};

/**
 * Generates vector embeddings for a batch of texts using configured embedding provider
 * @param {Array<string>} texts
 * @param {Object} options
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts, options = {}) => {
    return embeddings.embedTexts(texts, options);
};

module.exports = {
    generateEmbedding,
    generateEmbeddingsBatch
};
