/**
 * Layer 4 — Vector Search Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache raw Qdrant search results
 * - Cache by normalized query vector hash + metadata filters + limit
 * - Intercept repetitive vector similarity searches
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer4_VectorSearchCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER4_TTL || 600); // 10 minutes
        const maxEntries = Number(process.env.CACHE_LAYER4_MAX || 500);

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
            // Hash first, middle, and last vector floats + length for fast fingerprinting
            const sample = [
                queryEmbedding[0],
                queryEmbedding[Math.floor(queryEmbedding.length / 2)],
                queryEmbedding[queryEmbedding.length - 1],
                queryEmbedding.length
            ].join(":");
            vectorHash = crypto.createHash("md5").update(sample + ":" + queryEmbedding.slice(0, 10).join(",")).digest("hex").slice(0, 16);
        }

        const filterStr = filter ? JSON.stringify(filter) : "nofilter";
        const filterHash = crypto.createHash("md5").update(filterStr).digest("hex").slice(0, 12);

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
