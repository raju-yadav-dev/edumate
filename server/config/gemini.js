const fetch = require("node-fetch");

const getGeminiApiKey = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    }
    return key;
};

/**
 * Generate completion using Gemini 2.5 Flash
 * @param {Object} params
 * @param {Array} params.messages - Array of {role: 'system'|'user'|'assistant', content: string}
 * @param {number} [params.temperature=0.2]
 * @returns {Promise<Object>} - {success: boolean, content: string, provider: string}
 */
const generateCompletion = async ({ messages, temperature = 0.2 }) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    let systemInstruction = "";
    const contents = [];

    // Map OpenAI/Groq style messages to Gemini API format
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

    // Ensure we don't have empty contents (Gemini API requires at least one content block)
    if (contents.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: "Hello" }]
        });
    }

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: 1000
        }
    };

    if (systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini API Request failed with status ${response.status}`);
    }

    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
        success: true,
        content,
        provider: "gemini-2.5-flash"
    };
};

/**
 * Generate embedding for a single text using text-embedding-004
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const generateEmbedding = async (text) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "models/text-embedding-004",
            content: {
                parts: [{ text }]
            }
        })
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini Embedding API Request failed with status ${response.status}`);
    }

    const values = payload.embedding?.values;
    if (!Array.isArray(values)) {
        throw new Error("Gemini Embedding response did not return an array of values.");
    }

    return values;
};

/**
 * Generate embeddings for multiple texts using batchEmbedContents
 * @param {Array<string>} texts
 * @returns {Promise<Array<Array<number>>>}
 */
const generateEmbeddingsBatch = async (texts) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    const requests = texts.map((text) => ({
        model: "models/text-embedding-004",
        content: {
            parts: [{ text }]
        }
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`, {
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
        throw new Error(payload.error?.message || `Gemini Batch Embedding API Request failed with status ${response.status}`);
    }

    const embeddings = payload.embeddings;
    if (!Array.isArray(embeddings)) {
        throw new Error("Gemini Batch Embedding response did not return an array of embeddings.");
    }

    return embeddings.map((emb) => emb.values);
};

module.exports = {
    generateCompletion,
    generateEmbedding,
    generateEmbeddingsBatch
};
