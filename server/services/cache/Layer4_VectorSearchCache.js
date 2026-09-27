/**
 * Layer 4 — Vector Search Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache Qdrant vector retrieval results (retrieved chunk IDs and scores)
 * - Key: Deterministic SHA-256 hash of embedding vector + sorted metadata filters + limit + collection
 * - TTL: 15 minutes (900 seconds)
 * - Invalidation on document indexing/upload
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer4_VectorSearchCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER4_TTL || 900); // 15 minutes per Mission 17
        const maxEntries = Number(process.env.CACHE_LAYER4_MAX || 1000);

        this.cache = new BaseLRUCache({
            name: "Layer4_VectorSearch",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });
    }

    _buildKey(queryEmbedding, filter = {}, limit = 10, collection = "edumate_knowledge") {
        let vectorHash = "novector";
        if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
            const buf = Buffer.from(new Float32Array(queryEmbedding).buffer);
            vectorHash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 24);
        }

        let filterStr = "nofilter";
        if (filter && typeof filter === "object") {
            const sortedKeys = Object.keys(filter).sort();
            const sortedObj = {};
            for (const k of sortedKeys) {
                sortedObj[k] = filter[k];
            }
            filterStr = JSON.stringify(sortedObj);
        }
        const filterHash = crypto.createHash("sha256").update(filterStr).digest("hex").slice(0, 16);

        return `vecsearch:${collection}:${vectorHash}:${filterHash}:${limit}`;
    }

    getVectorSearch(queryEmbedding, filter = {}, limit = 10, collection = "edumate_knowledge") {
        const key = this._buildKey(queryEmbedding, filter, limit, collection);
        return this.cache.get(key);
    }

    setVectorSearch(queryEmbedding, filter = {}, limit = 10, results = [], collection = "edumate_knowledge", categories = [], ttl = null) {
        if (!Array.isArray(results)) return false;
        const key = this._buildKey(queryEmbedding, filter, limit, collection);
        return this.cache.set(key, results, ttl, categories);
    }

    invalidateCategory(category) {
        return this.cache.invalidateCategory(category);
    }

    clear() {
        return this.cache.clear();
    }

    getStats() {
        const stats = this.cache.getStats();
        return {
            layer: 4,
            name: "Layer 4 — Vector Search Cache",
            size: stats.size,
            maxEntries: stats.maxEntries,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hitRate,
            hitRatePercent: stats.hitRatePercent,
            missRate: stats.missRate,
            missRatePercent: stats.missRatePercent,
            evictions: stats.evictions,
            avgLookupTimeMs: stats.avgLookupTimeMs,
            memoryBytes: stats.memoryBytes,
            memoryFormatted: stats.memoryFormatted,
            status: "healthy"
        };
    }
}

module.exports = new Layer4_VectorSearchCache();
