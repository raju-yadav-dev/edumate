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

            if (response.ok) {
                return response;
            }

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

let cachedDimension = null;

/**
 * Validates the embedding model by generating a test embedding on startup
 * and returning its actual dimension size. Caches the result.
 * @returns {Promise<number>}
 */
const getTestEmbeddingDimension = async (options = {}) => {
    if (cachedDimension !== null) {
        return cachedDimension;
    }

    console.log("[Embedding API] Testing embedding provider connection & verifying dimension size...");
    try {
        const testVector = await embedText("test", options);
        if (Array.isArray(testVector) && testVector.length > 0) {
            cachedDimension = testVector.length;
            console.log(`[Embedding API] Verification successful. Detected dimension: ${cachedDimension} (Model: ${process.env.EMBEDDING_MODEL || "gemini-embedding-001"})`);
            return cachedDimension;
        } else {
            throw new Error("Returned embedding is not a valid array.");
        }
    } catch (err) {
        console.error(`[Embedding API] CRITICAL: Startup embedding validation failed: ${err.message}`);
        throw err;
    }
};

let qdrantDimCache = null;
const getQdrantDimension = async () => {
    if (qdrantDimCache !== null) return qdrantDimCache;
    try {
        const { client: qdrantClient, collectionName: qdrantCollection } = require("./qdrant");
        const collectionInfo = await qdrantClient.getCollection(qdrantCollection);
        qdrantDimCache = collectionInfo.config?.params?.vectors?.size || 768;
        return qdrantDimCache;
    } catch (e) {
        return 768;
    }
};

const getEmbeddingProvider = () => {
    return process.env.EMBEDDING_PROVIDER || "jina";
};

/**
 * Generates an embedding vector for a single text fragment using the selected provider
 * @param {string} text
 * @param {object} options
 * @returns {Promise<Array<number>>}
 */
const embedText = async (text, options = {}) => {
    if (!text || typeof text !== "string") {
        throw new Error("Input text must be a valid non-empty string.");
    }

    const provider = getEmbeddingProvider();

    if (provider === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const model = process.env.EMBEDDING_MODEL || process.env.OLLAMA_EMBEDDING_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || 8000);
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
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 8000);
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
    } else if (provider === "jina") {
        const apiKey = process.env.JINA_API_KEY;
        if (!apiKey) {
            throw new Error("[Embedding API] JINA_API_KEY is not set.");
        }
        const modelName = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = 768;

        const qdrantDim = await getQdrantDimension();
        console.log(`[Embedding API] Request - Provider: ${provider}, Model: ${modelName}, Task: ${task}, Chunks: 1, Qdrant Dim: ${qdrantDim}, Batch: 1/1`);

        try {
            const response = await fetchWithRetry(`https://api.jina.ai/v1/embeddings`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    task: task,
                    dimensions: dimensions,
                    input: [text]
                }),
                timeout: options.timeout || 10000
            }, options.maxAttempts || 3);

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.detail || payload.message || `Jina Embedding API error: ${response.status}`);
            }

            const embedding = payload.data?.[0]?.embedding;
            if (!Array.isArray(embedding)) {
                throw new Error("Jina Embedding did not return an array of values.");
            }

            console.log(`[Embedding API] Success - Returned vector dimension: ${embedding.length}, Qdrant Dim: ${qdrantDim}`);
            return embedding;
        } catch (err) {
            console.error(`[Embedding API] Failure - Jina embedding error: ${err.message}`);
            throw err;
        }
    } else {
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
};

/**
 * Generates embedding vectors for a batch of text fragments
 * @param {Array<string>} texts
 * @param {object} options
 * @returns {Promise<Array<Array<number>>>}
 */
const embedTexts = async (texts, options = {}) => {
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
            const emb = await embedText(text, options);
            results.push(emb);
        }
        return results;
    } else if (provider === "jina") {
        const apiKey = process.env.JINA_API_KEY;
        if (!apiKey) {
            throw new Error("[Embedding API] JINA_API_KEY is not set.");
        }
        const modelName = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = 768;

        const qdrantDim = await getQdrantDimension();
        const batchSize = 32;
        const results = [];
        const totalBatches = Math.ceil(sanitized.length / batchSize);

        for (let i = 0; i < sanitized.length; i += batchSize) {
            const batchNum = Math.floor(i / batchSize) + 1;
            const subBatch = sanitized.slice(i, i + batchSize);
            console.log(`[Embedding API] Batch ${batchNum}/${totalBatches} - Provider: ${provider}, Model: ${modelName}, Task: ${task}, Chunks: ${subBatch.length}, Qdrant Dim: ${qdrantDim}`);

            try {
                const response = await fetchWithRetry(`https://api.jina.ai/v1/embeddings`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        task: task,
                        dimensions: dimensions,
                        input: subBatch
                    }),
                    timeout: options.timeout || 15000
                }, options.maxAttempts || 3);

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.detail || payload.message || `Jina Batch Embedding API error: ${response.status}`);
                }

                const embeddingsData = payload.data;
                if (!Array.isArray(embeddingsData)) {
                    throw new Error("Jina Batch Embedding did not return a valid data array.");
                }

                const sorted = [...embeddingsData].sort((a, b) => a.index - b.index);
                const batchVectors = sorted.map((item) => item.embedding);
                results.push(...batchVectors);

                console.log(`[Embedding API] Batch ${batchNum}/${totalBatches} Success - Returned vector dimension: ${batchVectors[0]?.length || "Unknown"}`);
            } catch (batchError) {
                console.error(`[Embedding API] Batch ${batchNum}/${totalBatches} Failure - Jina batch request failed: ${batchError.message}`);
                throw batchError;
            }
        }

        return results;
    } else {
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
};

module.exports = {
    embedText,
    embedTexts,
    getTestEmbeddingDimension
};
