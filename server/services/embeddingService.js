const gemini = require("../config/gemini");

/**
 * Generates vector embedding for a single text using Gemini text-embedding-004
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("Text must be a non-empty string.");
    }
    return gemini.generateEmbedding(text);
};

/**
 * Generates vector embeddings for a batch of texts using Gemini batchEmbedContents
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts) => {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    // Filter out empty strings
    const sanitizedTexts = texts.map((t) => String(t || "").trim()).filter(Boolean);
    if (sanitizedTexts.length === 0) {
        return [];
    }

    // Google API allows batch request up to 100 requests per batch.
    // We will batch-request in sub-batches of 50 to avoid API payload limit issues.
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < sanitizedTexts.length; i += batchSize) {
        const subBatch = sanitizedTexts.slice(i, i + batchSize);
        const subEmbeddings = await gemini.generateEmbeddingsBatch(subBatch);
        results.push(...subEmbeddings);
    }

    return results;
};

module.exports = {
    generateEmbedding,
    generateEmbeddingsBatch
};
