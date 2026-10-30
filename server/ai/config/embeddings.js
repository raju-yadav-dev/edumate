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

const JINA_MAX_RETRIES = Number(process.env.JINA_MAX_RETRIES) || 8;
const JINA_RETRY_DELAY_MS = Number(process.env.JINA_RETRY_DELAY_MS) || 2000;
const JINA_MAX_RETRY_DELAY_MS = Number(process.env.JINA_MAX_RETRY_DELAY_MS) || 30000;

// Concurrency queue for Jina embedding requests
const JINA_MAX_CONCURRENT_REQUESTS = Number(process.env.JINA_MAX_CONCURRENT_REQUESTS) || 1;
let activeRequests = 0;
const requestQueue = [];

const acquireSlot = async () => {
    if (activeRequests < JINA_MAX_CONCURRENT_REQUESTS) {
        activeRequests++;
        return;
    }
    return new Promise((resolve) => {
        requestQueue.push(resolve);
    });
};

const releaseSlot = () => {
    activeRequests--;
    if (requestQueue.length > 0 && activeRequests < JINA_MAX_CONCURRENT_REQUESTS) {
        activeRequests++;
        const next = requestQueue.shift();
        next();
    }
};

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

const fetchWithRetry = async (url, options, maxAttempts = 8) => {
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
                let backoffDelay = retryAfterMs;
                if (!backoffDelay) {
                    backoffDelay = JINA_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
                }
                backoffDelay = Math.min(backoffDelay, JINA_MAX_RETRY_DELAY_MS);
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
            let backoffDelay = JINA_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
            backoffDelay = Math.min(backoffDelay, JINA_MAX_RETRY_DELAY_MS);
            console.error(`[Embedding API] Request error. Retrying attempt ${attempt}/${maxAttempts} after ${Math.round(backoffDelay)}ms... Error: ${error.message}`);
            await sleep(backoffDelay);
        }
    }
};

let cachedDimension = null;
let cachedAvailability = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache

const getEmbeddingAvailability = async () => {
    const now = Date.now();
    if (cachedAvailability !== null && (now - lastCheckTime < CACHE_TTL_MS)) {
        return cachedAvailability;
    }

    try {
        const testVector = await embedText("test", { timeout: 3000, maxAttempts: 1 });
        if (Array.isArray(testVector) && testVector.length > 0) {
            cachedAvailability = { available: true };
        } else {
            cachedAvailability = { available: false, reason: "Embedding provider unavailable" };
        }
    } catch (err) {
        const errMsg = err.message || "";
        const isQuotaErr = errMsg.includes("Insufficient account balance") || 
                           errMsg.includes("quota") || 
                           errMsg.includes("402") || 
                           errMsg.includes("429");
        if (isQuotaErr) {
            cachedAvailability = { available: false, reason: "Embedding provider unavailable" };
        } else {
            cachedAvailability = { available: true };
        }
    }
    lastCheckTime = now;
    return cachedAvailability;
};

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
            cachedAvailability = { available: true };
            return cachedDimension;
        } else {
            throw new Error("Returned embedding is not a valid array.");
        }
    } catch (err) {
        const errMsg = err.message || "";
        const isQuotaErr = errMsg.includes("Insufficient account balance") || 
                           errMsg.includes("quota") || 
                           errMsg.includes("402") || 
                           errMsg.includes("429");
        
        if (isQuotaErr) {
            cachedAvailability = { available: false, reason: "Embedding provider unavailable" };
            console.warn(`[Embedding API] Warning: Jina quota exhausted. (${errMsg})`);
            console.warn("[Embedding API] Embedding service unavailable for new indexing.");
            console.log("[Startup] Continuing server startup.");
            cachedDimension = 768; // Fallback so startup continues
            return 768;
        }
        
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

    const smartCacheHub = require("../../services/cache/SmartCacheHub");

    // 1. Layer 3 (Memory Embedding Cache) Check
    const cachedMemory = smartCacheHub.l3.getEmbedding(text, options);
    if (cachedMemory) {
        return cachedMemory;
    }

    // 2. Layer 10 (Persistent Disk Cache) Check
    const diskKey = smartCacheHub.l3._buildKey(text, options);
    const cachedDisk = smartCacheHub.l10.get("embeddings", diskKey);
    if (cachedDisk && Array.isArray(cachedDisk)) {
        smartCacheHub.l3.setEmbedding(text, cachedDisk, options, options.categories || []);
        return cachedDisk;
    }

    const provider = getEmbeddingProvider();

    if (provider === "jina") {
        const apiKey = process.env.JINA_API_KEY;
        if (!apiKey) {
            throw new Error("[Embedding API] JINA_API_KEY is not set.");
        }
        const modelName = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = 768;

        const qdrantDim = await getQdrantDimension();
        console.log(`[Embedding API] Request - Provider: ${provider}, Model: ${modelName}, Task: ${task}, Chunks: 1, Qdrant Dim: ${qdrantDim}, Batch: 1/1`);

        await acquireSlot();
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
            }, options.maxAttempts || JINA_MAX_RETRIES);

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.detail || payload.message || `Jina Embedding API error: ${response.status}`);
            }

            const embedding = payload.data?.[0]?.embedding;
            if (!Array.isArray(embedding)) {
                throw new Error("Jina Embedding did not return an array of values.");
            }

            console.log(`[Embedding API] Success - Returned vector dimension: ${embedding.length}, Qdrant Dim: ${qdrantDim}`);

            // Cache in Layer 3 (Memory) and Layer 10 (Persistent Disk)
            smartCacheHub.l3.setEmbedding(text, embedding, options, options.categories || []);
            smartCacheHub.l10.set("embeddings", diskKey, embedding, 86400 * 30, options.categories || []);

            return embedding;
        } catch (err) {
            console.error(`[Embedding API] Failure - Jina embedding error: ${err.message}`);
            throw err;
        } finally {
            releaseSlot();
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

    const smartCacheHub = require("../../services/cache/SmartCacheHub");

    // Check Layer 3 & Layer 10 for all texts in batch
    const results = new Array(sanitized.length).fill(null);
    const missingIndices = [];

    sanitized.forEach((text, idx) => {
        const mem = smartCacheHub.l3.getEmbedding(text, options);
        if (mem) {
            results[idx] = mem;
            return;
        }
        const diskKey = smartCacheHub.l3._buildKey(text, options);
        const disk = smartCacheHub.l10.get("embeddings", diskKey);
        if (disk && Array.isArray(disk)) {
            smartCacheHub.l3.setEmbedding(text, disk, options, options.categories || []);
            results[idx] = disk;
            return;
        }
        missingIndices.push(idx);
    });

    if (missingIndices.length === 0) {
        return results;
    }

    const missingTexts = missingIndices.map(i => sanitized[i]);
    const provider = getEmbeddingProvider();

    if (provider === "jina") {
        const apiKey = process.env.JINA_API_KEY;
        if (!apiKey) {
            throw new Error("[Embedding API] JINA_API_KEY is not set.");
        }
        const modelName = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = 768;

        const qdrantDim = await getQdrantDimension();
        const batchSize = 16;
        const totalBatches = Math.ceil(missingTexts.length / batchSize);

        for (let i = 0; i < missingTexts.length; i += batchSize) {
            const batchNum = Math.floor(i / batchSize) + 1;
            const subBatch = missingTexts.slice(i, i + batchSize);
            const subBatchOriginalIndices = missingIndices.slice(i, i + batchSize);
            if (i > 0) {
                await sleep(350);
            }

            console.log(`[Embedding API] Batch ${batchNum}/${totalBatches} - Provider: ${provider}, Model: ${modelName}, Task: ${task}, Chunks: ${subBatch.length}, Qdrant Dim: ${qdrantDim}`);

            await acquireSlot();
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
                }, options.maxAttempts || JINA_MAX_RETRIES);

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.detail || payload.message || `Jina Batch Embedding API error: ${response.status}`);
                }

                const embeddingsData = payload.data;
                if (!Array.isArray(embeddingsData)) {
                    throw new Error("Jina Batch Embedding did not return a valid data array.");
                }

                const sorted = [...embeddingsData].sort((a, b) => a.index - b.index);
                sorted.forEach((item, itemIdx) => {
                    const originalIdx = subBatchOriginalIndices[itemIdx];
                    const vector = item.embedding;
                    results[originalIdx] = vector;

                    const originalText = sanitized[originalIdx];
                    const diskKey = smartCacheHub.l3._buildKey(originalText, options);
                    smartCacheHub.l3.setEmbedding(originalText, vector, options, options.categories || []);
                    smartCacheHub.l10.set("embeddings", diskKey, vector, 86400 * 30, options.categories || []);
                });

                console.log(`[Embedding API] Batch ${batchNum}/${totalBatches} Success - Returned vector dimension: ${sorted[0]?.embedding?.length || "Unknown"}`);
            } catch (batchError) {
                console.error(`[Embedding API] Batch ${batchNum}/${totalBatches} Failure - Jina batch request failed: ${batchError.message}`);
                throw batchError;
            } finally {
                releaseSlot();
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
    getTestEmbeddingDimension,
    getEmbeddingAvailability
};
