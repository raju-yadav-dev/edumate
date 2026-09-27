/**
 * Layer 3 — Embedding Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache generated embeddings for queries and chunk documents
 * - Never regenerate embeddings for identical text content
 * - Support single and batch lookups/caching
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer3_EmbeddingCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER3_TTL || 86400 * 7); // 7 days TTL (embeddings are deterministic)
        const maxEntries = Number(process.env.CACHE_LAYER3_MAX || 10000);

        this.cache = new BaseLRUCache({
            name: "Layer3_Embeddings",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });
    }

    _buildKey(text, options = {}) {
        const provider = options.provider || process.env.EMBEDDING_PROVIDER || "jina";
        const model = options.model || process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = options.dimensions || 768;

        const cleanText = String(text || "").trim();
        const textHash = crypto.createHash("sha256").update(cleanText).digest("hex");

        return `emb:${provider}:${model}:${task}:${dimensions}:${textHash}`;
    }

    getEmbedding(text, options = {}) {
        if (!text || typeof text !== "string") return null;
        const key = this._buildKey(text, options);
        return this.cache.get(key);
    }

    setEmbedding(text, vector, options = {}, categories = []) {
        if (!text || !Array.isArray(vector) || vector.length === 0) return false;
        const key = this._buildKey(text, options);
        return this.cache.set(key, vector, options.ttl || null, categories);
    }

    getBatchEmbeddings(texts = [], options = {}) {
        if (!Array.isArray(texts) || texts.length === 0) return [];
        const results = new Array(texts.length).fill(null);
        let missingIndices = [];

        texts.forEach((t, idx) => {
            const cached = this.getEmbedding(t, options);
            if (cached) {
                results[idx] = cached;
            } else {
                missingIndices.push(idx);
            }
        });

        return {
            results,
            missingIndices,
            allFound: missingIndices.length === 0
        };
    }

    setBatchEmbeddings(textsWithVectors = [], options = {}, categories = []) {
        if (!Array.isArray(textsWithVectors)) return 0;
        let count = 0;
        for (const item of textsWithVectors) {
            if (item && item.text && item.vector) {
                if (this.setEmbedding(item.text, item.vector, options, categories)) {
                    count++;
                }
            }
        }
        return count;
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
            layer: 3,
            name: "Layer 3 — Embedding Cache",
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

    dumpEntries() {
        return this.cache.dumpEntries();
    }

    hydrateEntries(entries) {
        return this.cache.hydrateEntries(entries);
    }
}

module.exports = new Layer3_EmbeddingCache();
