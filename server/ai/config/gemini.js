const AI_CONSTANTS = require("../constants/aiConstants");

const getApiKey = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables.");
    }
    return key;
};

/**
 * Sends a generation request to the Gemini 2.5 Flash API
 * @param {Array<Object>} messages - Array of { role: 'system'|'user'|'assistant', content: string }
 * @param {Object} [options={}] - Optional options
 * @returns {Promise<string>}
 */
const generateCompletion = async (messages, options = {}) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const modelName = process.env.GEMINI_COMPLETION_MODEL || AI_CONSTANTS.COMPLETION_MODEL;
    let systemInstruction = "";
    const contents = [];

    // Map roles to Google Gemini's API format
    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction += (systemInstruction ? "\n" : "") + msg.content;
        } else {
            const geminiRole = msg.role === "assistant" ? "model" : "user";
            contents.push({
                role: geminiRole,
                parts: [{ text: msg.content }]
            });
        }
    }

    if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const body = {
        contents,
        generationConfig: {
            temperature: options.temperature !== undefined ? options.temperature : 0.2,
            maxOutputTokens: options.maxOutputTokens || 1000
        }
    };

    if (systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Completion API error: ${response.status}`);
    }

    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

/**
 * Sends an embedding request for a single string to text-embedding-004
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const modelName = process.env.GEMINI_EMBEDDING_MODEL || AI_CONSTANTS.EMBEDDING_MODEL;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: `models/${modelName}`,
            content: {
                parts: [{ text }]
            },
            outputDimensionality: 768
        })
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Embedding API error: ${response.status}`);
    }

    const values = payload.embedding?.values;
    if (!Array.isArray(values)) {
        throw new Error("Gemini Embedding did not return an array of values.");
    }

    return values;
};

/**
 * Sends a batch embedding request to text-embedding-004
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const modelName = process.env.GEMINI_EMBEDDING_MODEL || AI_CONSTANTS.EMBEDDING_MODEL;
    const requests = texts.map((text) => ({
        model: `models/${modelName}`,
        content: {
            parts: [{ text }]
        },
        outputDimensionality: 768
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:batchEmbedContents?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            requests
        })
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Batch Embedding API error: ${response.status}`);
    }

    const embeddings = payload.embeddings;
    if (!Array.isArray(embeddings)) {
        throw new Error("Gemini Batch Embedding did not return an array of embeddings.");
    }

    return embeddings.map((emb) => emb.values);
};

module.exports = {
    generateCompletion,
    generateEmbedding,
    generateEmbeddingsBatch
};
