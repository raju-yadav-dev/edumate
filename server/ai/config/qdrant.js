// Wrap global fetch to strip out incompatible custom Undici dispatchers in Node.js 26+
if (globalThis.fetch) {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = function (input, init) {
            if (init && init.dispatcher) {
                const { dispatcher, ...restInit } = init;
                return originalFetch.call(this, input, restInit);
            }
            return originalFetch.apply(this, arguments);
        };
    } catch (e) {
        try {
            globalThis.fetch = function (url, options) {
                if (options && options.dispatcher) {
                    try {
                        delete options.dispatcher;
                    } catch (err) {}
                }
                return originalFetch.apply(this, arguments);
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

        if (!exists) {
            console.log(`Qdrant Collection "${collectionName}" not found. Creating collection...`);
            await client.createCollection(collectionName, {
                vectors: {
                    size: 768, // Dimension size of Gemini text-embedding-004
                    distance: "Cosine"
                }
            });
            console.log(`Qdrant Collection "${collectionName}" created successfully.`);
        } else {
            console.log(`Qdrant Collection "${collectionName}" connection verified.`);
        }
    } catch (e) {
        console.error(`Qdrant Connection Error: Unable to configure collection "${collectionName}": ${e.message}`);
    }
};

// Export client resources without triggering side-effect auto-creation on require
module.exports = {
    client,
    collectionName,
    ensureCollection
};
