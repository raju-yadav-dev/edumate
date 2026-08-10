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

const { QdrantClient } = require("@qdrant/js-client-rest");

const qdrantUrl = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;
const collectionName = process.env.QDRANT_COLLECTION || "edumate";

// Initialize Qdrant Client
const client = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
    checkCompatibility: false
});

/**
 * Checks for connection and creates target collection if it doesn't exist
 * @returns {Promise<void>}
 */
const ensureCollection = async () => {
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
        const qdrantDimension = collectionInfo.config?.params?.vectors?.size;

        if (qdrantDimension !== 768) {
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
    } catch (e) {
        console.error(`Qdrant Connection Error: Unable to configure collection "${collectionName}": ${e.message}`);
        throw e;
    }
};

// Export client resources without triggering side-effect auto-creation on require
module.exports = {
    client,
    collectionName,
    ensureCollection
};
