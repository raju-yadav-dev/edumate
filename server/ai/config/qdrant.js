// Wrap global fetch to strip out incompatible custom Undici dispatchers in Node.js 26+
if (globalThis.fetch) {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = function (input, init) {
            if (init && init.dispatcher) {
                const { dispatcher, ...restInit } = init;
                return originalFetch(input, restInit);
            }
            return originalFetch(input, init);
        };
    } catch (e) {
        try {
            globalThis.fetch = function (url, options) {
                if (options && options.dispatcher) {
                    try {
                        delete options.dispatcher;
                    } catch (err) {}
                }
                return originalFetch(url, options);
            };
        } catch (err) {}
    }
}

let QdrantClientClass = null;
try {
    QdrantClientClass = require("@qdrant/js-client-rest").QdrantClient;
} catch (e) {}
const { withTimeoutAndRetry } = require("../../utils/fetchHelper");

const qdrantUrl = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;
const collectionName = process.env.QDRANT_COLLECTION || "edumate";
const qdrantVectorName = process.env.QDRANT_VECTOR_NAME || "default";

// Circuit Breaker State
let qdrantOfflineUntil = 0;
const OFFLINE_COOLDOWN_MS = 8000;
const isRemoteUrl = !qdrantUrl.includes("127.0.0.1") && !qdrantUrl.includes("localhost");
const DEFAULT_PROBE_TIMEOUT = Number(process.env.QDRANT_PROBE_TIMEOUT_MS) || (isRemoteUrl ? 2000 : 600);

const isQdrantAvailable = async (probeTimeoutMs = DEFAULT_PROBE_TIMEOUT) => {
    const now = Date.now();
    if (now < qdrantOfflineUntil) {
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), probeTimeoutMs);
        const res = await fetch(`${qdrantUrl}/collections`, {
            method: "GET",
            headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {},
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res && res.ok) {
            qdrantOfflineUntil = 0;
            return true;
        }
        qdrantOfflineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
        return false;
    } catch (_) {
        qdrantOfflineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
        return false;
    }
};

const isNetworkError = (err) => {
    if (!err) return false;
    const msg = (err.message || "").toLowerCase();
    const code = err.code || (err.cause && err.cause.code) || "";
    return msg.includes("econnrefused") ||
           msg.includes("enotfound") ||
           msg.includes("enetunreach") ||
           msg.includes("abort") ||
           msg.includes("timeout") ||
           msg.includes("service is currently offline") ||
           code === "ECONNREFUSED" ||
           code === "ENOTFOUND" ||
           err.status === 502 ||
           err.status === 503 ||
           err.status === 504;
};

// Initialize Qdrant Client lazily
let rawClient = null;
const client = new Proxy({}, {
    get(target, prop) {
        if (!rawClient) {
            if (!QdrantClientClass) {
                try {
                    QdrantClientClass = require("@qdrant/js-client-rest").QdrantClient;
                } catch (err) {
                    throw new Error("@qdrant/js-client-rest is not installed or unavailable.");
                }
            }
            rawClient = new QdrantClientClass({
                url: qdrantUrl,
                apiKey: qdrantApiKey,
                checkCompatibility: false
            });
        }
        const origMethod = rawClient[prop];
        if (typeof origMethod === "function") {
            return async function (...args) {
                if (Date.now() < qdrantOfflineUntil) {
                    throw new Error("Qdrant service is currently offline (circuit breaker active)");
                }
                try {
                    return await withTimeoutAndRetry(
                        () => origMethod.apply(rawClient, args),
                        Number(process.env.QDRANT_TIMEOUT_MS) || 5000,
                        2,
                        300,
                        `Qdrant.${prop}`
                    );
                } catch (err) {
                    if (isNetworkError(err)) {
                        console.warn(`[QDRANT] Network/connectivity failure detected on Qdrant.${prop}. Tripping circuit breaker for ${OFFLINE_COOLDOWN_MS}ms.`);
                        qdrantOfflineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
                    } else {
                        console.warn(`[QDRANT] Client error on Qdrant.${prop}: ${err.message}. Circuit breaker not tripped.`);
                    }
                    throw err;
                }
            };
        }
        return origMethod;
    }
});

let cachedVectorFormat = null;

/**
 * Dynamically resolves whether target collection vectors are named or unnamed.
 * @returns {Promise<{ isNamed: boolean, vectorName: string }>}
 */
const getVectorFormat = async () => {
    if (cachedVectorFormat) return cachedVectorFormat;
    try {
        const info = await client.getCollection(collectionName);
        const vConfig = info?.config?.params?.vectors;
        if (vConfig && typeof vConfig === "object") {
            if (vConfig.size) {
                cachedVectorFormat = { isNamed: false, vectorName: "" };
            } else {
                const availableNames = Object.keys(vConfig);
                const targetName = (qdrantVectorName && vConfig[qdrantVectorName])
                    ? qdrantVectorName
                    : (vConfig.default ? "default" : (availableNames[0] || "default"));
                cachedVectorFormat = { isNamed: true, vectorName: targetName };
            }
        } else {
            cachedVectorFormat = { isNamed: false, vectorName: "" };
        }
    } catch (e) {
        cachedVectorFormat = { isNamed: false, vectorName: "" };
    }
    return cachedVectorFormat;
};

/**
 * Formats vector payload for Qdrant search dynamically based on collection schema.
 * @param {Array<number>} queryEmbedding
 * @returns {Promise<Array<number>|{ name: string, vector: Array<number> }>}
 */
const formatSearchVector = async (queryEmbedding) => {
    const fmt = await getVectorFormat();
    if (fmt.isNamed) {
        return { name: fmt.vectorName, vector: queryEmbedding };
    }
    return queryEmbedding;
};

/**
 * Formats vector payload for Qdrant point upsert dynamically based on collection schema.
 * @param {Array<number>} pointEmbedding
 * @returns {Promise<Array<number>|Object>}
 */
const formatPointVector = async (pointEmbedding) => {
    const fmt = await getVectorFormat();
    if (fmt.isNamed) {
        return { [fmt.vectorName]: pointEmbedding };
    }
    return pointEmbedding;
};

let isCollectionEnsured = false;

/**
 * Checks for connection and creates target collection if it doesn't exist
 * @returns {Promise<void>}
 */
const ensureCollection = async () => {
    if (isCollectionEnsured) return;
    try {
        const response = await client.getCollections();
        const collections = response.collections || [];
        const exists = collections.some((c) => c.name === collectionName);

        // Dynamically retrieve actual embedding dimension from configured model
        const { getTestEmbeddingDimension } = require("./embeddings");
        const actualEmbeddingDimension = await getTestEmbeddingDimension();
        const provider = process.env.EMBEDDING_PROVIDER || "jina";
        const model = process.env.EMBEDDING_MODEL || "jina-embeddings-v3";

        // Validate actual dimension is 768 for Jina
        if (actualEmbeddingDimension !== 768) {
            console.error(`
Provider: ${provider}
Model: ${model}
Embedding dimension: ${actualEmbeddingDimension}
Qdrant dimension: Unknown
Status: FAIL
`);
            throw new Error(`Embedding validation failed: Expected dimension 768, but got ${actualEmbeddingDimension}`);
        }

        if (!exists) {
            console.log(`Qdrant Collection "${collectionName}" not found. Creating collection...`);
            await client.createCollection(collectionName, {
                vectors: {
                    size: actualEmbeddingDimension,
                    distance: "Cosine"
                }
            });
            console.log(`Qdrant Collection "${collectionName}" created successfully with dimension ${actualEmbeddingDimension}.`);
        }

        // Retrieve collection details to verify dimension size
        const collectionInfo = await client.getCollection(collectionName);
        const vectorsConfig = collectionInfo.config?.params?.vectors;

        let qdrantDimension = null;
        let vectorName = null;

        if (
            vectorsConfig &&
            typeof vectorsConfig === "object" &&
            qdrantVectorName &&
            vectorsConfig[qdrantVectorName] &&
            vectorsConfig[qdrantVectorName].size
        ) {
            qdrantDimension = vectorsConfig[qdrantVectorName].size;
            vectorName = qdrantVectorName;
        } else if (
            vectorsConfig &&
            typeof vectorsConfig === "object" &&
            vectorsConfig[""] &&
            vectorsConfig[""].size
        ) {
            qdrantDimension = vectorsConfig[""].size;
            vectorName = "";
        } else if (
            vectorsConfig &&
            typeof vectorsConfig === "object" &&
            vectorsConfig.default &&
            vectorsConfig.default.size
        ) {
            qdrantDimension = vectorsConfig.default.size;
            vectorName = "default";
        } else if (
            vectorsConfig &&
            typeof vectorsConfig === "object" &&
            vectorsConfig.size
        ) {
            qdrantDimension = vectorsConfig.size;
            vectorName = "";
        } else if (vectorsConfig && typeof vectorsConfig === "object") {
            const firstKey = Object.keys(vectorsConfig)[0];
            if (firstKey !== undefined && vectorsConfig[firstKey]?.size) {
                qdrantDimension = vectorsConfig[firstKey].size;
                vectorName = firstKey;
            }
        }

        if (!qdrantDimension) {
            throw new Error("Unable to determine Qdrant vector dimension.");
        }

        console.log(`[Embedding API] Verification successful.`);
        console.log(`Detected embedding dimension: ${actualEmbeddingDimension}\n`);
        console.log(`[QDRANT] Collection detected: ${collectionName}`);
        if (vectorName && vectorName !== "unnamed") {
            console.log(`[QDRANT] Vector name: ${vectorName}`);
        }
        console.log(`[QDRANT] Vector dimension: ${qdrantDimension}\n`);

        if (qdrantDimension !== actualEmbeddingDimension) {
            console.error(`
Provider: ${provider}
Model: ${model}
Embedding dimension: ${actualEmbeddingDimension}
Qdrant dimension: ${qdrantDimension}
Status: FAIL
`);
            throw new Error(`Embedding dimension mismatch: Model is ${actualEmbeddingDimension}, Qdrant is ${qdrantDimension}`);
        }

        console.log(`
Provider: ${provider}
Model: ${model}
Embedding dimension: ${actualEmbeddingDimension}
Qdrant dimension: ${qdrantDimension}
Status: PASS
`);

        // Ensure payload field indexes for Qdrant filtering
        const indexedFields = ["documentId", "sourceDocumentId", "category", "institution", "department", "documentType"];
        for (const field of indexedFields) {
            try {
                await client.createPayloadIndex(collectionName, { field_name: field, field_schema: "keyword" });
            } catch (_) {}
        }

        isCollectionEnsured = true;
    } catch (e) {
        console.error(`Qdrant Connection Error: Unable to configure collection "${collectionName}": ${e.message}`);
        throw e;
    }
};

// Export client resources without triggering side-effect auto-creation on require
module.exports = {
    client,
    collectionName,
    ensureCollection,
    isQdrantAvailable,
    vectorName: qdrantVectorName,
    getVectorFormat,
    formatSearchVector,
    formatPointVector
};
