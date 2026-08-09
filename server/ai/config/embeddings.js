const AI_CONSTANTS = require("../constants/aiConstants");

// Secure fetch selection to support both Node global fetch and node-fetch package
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPermanentNetworkError = (error) => {
    const msg = error.message || "";
    const code = error.code || (error.cause && error.cause.code) || "";
    return msg.includes("ENOTFOUND") || 
           msg.includes("ECONNREFUSED") || 
           msg.includes("EAI_AGAIN") ||
           msg.includes("ENETUNREACH") ||
           code === "ENOTFOUND" || 
           code === "ECONNREFUSED" || 
           code === "EAI_AGAIN" ||
           code === "ENETUNREACH";
};

const fetchWithRetry = async (url, options, maxAttempts = 6) => {
    let attempt = 0;
    const timeoutMs = options.timeout || 15000; // 15s timeout
    while (attempt < maxAttempts) {
        attempt++;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const { timeout, ...fetchOptions } = options;
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const clone = response.clone();
            let isRateLimit = response.status === 429;
            let errorMessage = "";
            let retryAfterMs = 0;

            try {
                const payload = await response.json();
                if (payload.error) {
                    errorMessage = payload.error.message || "";
                    if (payload.error.code === 429 || errorMessage.toLowerCase().includes("quota exceeded") || errorMessage.toLowerCase().includes("rate limit")) {
                        isRateLimit = true;
                    }
                    const match = errorMessage.match(/retry in ([\d.]+)\s*s/i);
                    if (match && match[1]) {
                        retryAfterMs = parseFloat(match[1]) * 1000 + 1000;
                    }
                }
            } catch (e) {
                // Not JSON or parsing error
            }

            if (isRateLimit) {
                if (attempt >= maxAttempts) {
                    return clone;
                }
                const backoffDelay = retryAfterMs || (Math.pow(2, attempt) * 2000 + Math.random() * 1000);
                console.log(`[Embedding API] Rate limit hit. Retrying attempt ${attempt}/${maxAttempts} after ${Math.round(backoffDelay)}ms... Reason: ${errorMessage || "429 Status"}`);
                await sleep(backoffDelay);
                continue;
            }

            return clone;
        } catch (error) {
            clearTimeout(timeoutId);
            if (attempt >= maxAttempts || isPermanentNetworkError(error)) {
                throw error;
            }
            const backoffDelay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
            console.error(`[Embedding API] Request error. Retrying attempt ${attempt}/${maxAttempts} after ${Math.round(backoffDelay)}ms... Error: ${error.message}`);
            await sleep(backoffDelay);
        }
    }
};

const getMockEmbedding = (text) => {
    let hash = 0;
    const str = String(text || "");
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const vector = new Array(768).fill(0);
    for (let i = 0; i < 768; i++) {
        vector[i] = Math.sin(hash + i) * 0.1;
    }
    return vector;
};

const getEmbeddingProvider = () => {
    return process.env.EMBEDDING_PROVIDER || process.env.LLM_PROVIDER || "gemini";
};

const getGeminiApiKey = () => {
    return process.env.GEMINI_API_KEY;
};

/**
 * Generates an embedding vector for a single text fragment using the selected provider
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
const embedText = async (text) => {
    if (!text || typeof text !== "string") {
        throw new Error("Input text must be a valid non-empty string.");
    }

    const provider = getEmbeddingProvider();

    if (provider === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const model = process.env.EMBEDDING_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${baseUrl}/api/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({ model, input: text })
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const payload = await response.json();
                if (payload.embeddings && payload.embeddings[0]) {
                    return payload.embeddings[0];
                }
            }
        } catch (e) {
            // Fall back to /api/embeddings
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${baseUrl}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ model, prompt: text })
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama Embedding API error status ${response.status}: ${errText}`);
        }

        const payload = await response.json();
        if (!payload.embedding || !Array.isArray(payload.embedding)) {
            throw new Error("Ollama Embedding response did not return a valid embedding vector.");
        }
        return payload.embedding;
    } else {
        // Gemini
        const apiKey = getGeminiApiKey();
        if (!apiKey || !apiKey.startsWith("AIzaSy")) {
            console.warn("[Embedding API] GEMINI_API_KEY is not set or invalid (must start with 'AIzaSy'). Using mock fallback embedding.");
            return getMockEmbedding(text);
        }
        const modelName = process.env.EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL || AI_CONSTANTS.EMBEDDING_MODEL || "gemini-embedding-001";

        try {
            const requestBody = {
                model: `models/${modelName}`,
                content: { parts: [{ text }] }
            };
            
            // gemini-embedding-001 does not support outputDimensionality parameter
            if (modelName !== "gemini-embedding-001") {
                requestBody.outputDimensionality = 768;
            }

            const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
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
        } catch (err) {
            console.warn(`[Embedding API] Gemini embedding error: ${err.message}. Using mock fallback vector.`);
            return getMockEmbedding(text);
        }
    }
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

    const provider = getEmbeddingProvider();

    if (provider === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const model = process.env.EMBEDDING_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(`${baseUrl}/api/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({ model, input: sanitized })
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const payload = await response.json();
                if (payload.embeddings && Array.isArray(payload.embeddings)) {
                    return payload.embeddings;
                }
            }
        } catch (e) {
            // Fall back to sequential processing
        }

        const results = [];
        for (const text of sanitized) {
            const emb = await embedText(text);
            results.push(emb);
        }
        return results;
    } else {
        // Gemini batch embedding
        const apiKey = getGeminiApiKey();
        if (!apiKey || !apiKey.startsWith("AIzaSy")) {
            console.warn("[Embedding API] GEMINI_API_KEY is not set or invalid (must start with 'AIzaSy'). Returning mock batch embeddings.");
            return sanitized.map((t) => getMockEmbedding(t));
        }
        const modelName = process.env.EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL || AI_CONSTANTS.EMBEDDING_MODEL || "gemini-embedding-001";

        // Google batch api allows up to 100 requests per batch call. We chunk into sub-batches of 50.
        const batchSize = 50;
        const results = [];

        for (let i = 0; i < sanitized.length; i += batchSize) {
            if (i > 0) {
                await sleep(500);
            }
            const subBatch = sanitized.slice(i, i + batchSize);
            const requests = subBatch.map((text) => {
                const req = {
                    model: `models/${modelName}`,
                    content: { parts: [{ text }] }
                };
                
                // gemini-embedding-001 does not support outputDimensionality parameter
                if (modelName !== "gemini-embedding-001") {
                    req.outputDimensionality = 768;
                }
                return req;
            });

            try {
                const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:batchEmbedContents?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requests })
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error?.message || `Gemini Batch Embedding API error: ${response.status}`);
                }

                const embeddings = payload.embeddings;
                if (!Array.isArray(embeddings)) {
                    throw new Error("Gemini Batch Embedding did not return an array of embeddings.");
                }
                results.push(...embeddings.map((emb) => emb.values));
            } catch (batchError) {
                // If it is a network error or authentication/bad-request error, sequential requests will also fail.
                // Fallback immediately to mock embeddings to prevent timing out.
                const isNetworkOrAuthError = isPermanentNetworkError(batchError) ||
                                            batchError.message.includes("API key") ||
                                            batchError.message.includes("Forbidden") ||
                                            batchError.message.includes("API_KEY") ||
                                            batchError.message.includes("Bad Request") ||
                                            batchError.message.includes("status 400") ||
                                            batchError.message.includes("status 403");

                if (isNetworkOrAuthError) {
                    console.warn(`[Embedding API] Gemini batch request failed due to network/auth issue. Falling back to mock embeddings immediately. Error: ${batchError.message}`);
                    results.push(...subBatch.map((text) => getMockEmbedding(text)));
                } else {
                    console.warn(`[Embedding API] Gemini batch request failed. Falling back to individual requests. Error: ${batchError.message}`);
                    // Fallback to sequential individual embeds for this subBatch
                    for (const text of subBatch) {
                        try {
                            const emb = await embedText(text);
                            results.push(emb);
                        } catch (singleError) {
                            console.error(`[Embedding API] Individual embedding failed. Using mock fallback vector.`);
                            results.push(getMockEmbedding(text));
                        }
                        await sleep(100);
                    }
                }
            }
        }

        return results;
    }
};

module.exports = {
    embedText,
    embedTexts
};
