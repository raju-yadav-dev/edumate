const gemini = require("./gemini");

/**
 * Generates an embedding vector for a single text fragment
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const embedText = async (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("Input text must be a valid non-empty string.");
    }
    return gemini.generateEmbedding(text);
};

/**
 * Generates embedding vectors for a batch of text fragments
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const embedTexts = async (texts) => {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    const sanitized = texts.map((t) => String(t || "").trim()).filter(Boolean);
    if (sanitized.length === 0) {
        return [];
    }

    // Google batch api allows up to 100 requests per batch call.
    // We chunk them into sub-batches of 50 for safety.
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < sanitized.length; i += batchSize) {
        const subBatch = sanitized.slice(i, i + batchSize);
        const subEmbeddings = await gemini.generateEmbeddingsBatch(subBatch);
        results.push(...subEmbeddings);
    }

    return results;
};

module.exports = {
    embedText,
    embedTexts
};
