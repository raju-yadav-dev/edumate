const gemini = require("./gemini");
const ollama = require("./ollama");

const getProvider = () => {
    return process.env.LLM_PROVIDER === "ollama" ? ollama : gemini;
};

/**
 * Generates an embedding vector for a single text fragment
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const embedText = async (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("Input text must be a valid non-empty string.");
    }
    const provider = getProvider();
    return provider.generateEmbedding(text);
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

    const provider = getProvider();

    // If using Ollama, let its batch method handle batching directly
    if (process.env.LLM_PROVIDER === "ollama") {
        return provider.generateEmbeddingsBatch(sanitized);
    }

    // Google batch api allows up to 100 requests per batch call.
    // We chunk them into sub-batches of 50 for safety.
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < sanitized.length; i += batchSize) {
        const subBatch = sanitized.slice(i, i + batchSize);
        const subEmbeddings = await provider.generateEmbeddingsBatch(subBatch);
        results.push(...subEmbeddings);
    }

    return results;
};

module.exports = {
    embedText,
    embedTexts
};
