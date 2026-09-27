/**
 * Layer 6 — Retriever Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache reranked retrieval candidates after hybrid scoring (semantic, BM25, metadata, rerank scores)
 * - Key: Deterministic SHA-256 hash of normalized query + sorted metadata filters + institution + topK + kbVersion
 * - TTL: 15 minutes (900 seconds)
 * - Invalidation on document modification or KB version bump
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer6_RetrieverCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER6_TTL || process.env.RETRIEVAL_CACHE_TTL || 900); // 15 minutes per Mission 17
        const maxEntries = Number(process.env.CACHE_LAYER6_MAX || 1000);

        this.cache = new BaseLRUCache({
            name: "Layer6_Retriever",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });
    }

    _normalizeQuery(query) {
        return String(query || "")
            .toLowerCase()
            .trim()
            .normalize("NFC")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .replace(/\s+/g, " ");
    }

    _buildKey(query, metadataFilters = {}, kbVersion = "1", institution = "all", topK = null) {
        const normalized = this._normalizeQuery(query);
        const queryHash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);

        // Deterministic filter string
        const filterParts = [];
        if (metadataFilters && typeof metadataFilters === "object") {
            const sortedKeys = Object.keys(metadataFilters).sort();
            for (const k of sortedKeys) {
                if (metadataFilters[k] !== undefined && metadataFilters[k] !== null && metadataFilters[k] !== "") {
                    filterParts.push(`${k}=${String(metadataFilters[k]).trim().toLowerCase()}`);
                }
            }
        }
        const filterString = filterParts.join("&") || "nofilters";
        const filterHash = crypto.createHash("sha256").update(filterString).digest("hex").slice(0, 16);
        const inst = String(institution || "all").trim().toLowerCase();
        const kVal = topK ? `k${topK}` : "kdef";

        return `retriever:v1:kb${kbVersion}:${queryHash}:${filterHash}:${inst}:${kVal}`;
    }

    get(query, metadataFilters = {}, kbVersion = "1", institution = "all", topK = null) {
        if (!query) return null;
        const key = this._buildKey(query, metadataFilters, kbVersion, institution, topK);
        return this.cache.get(key);
    }

    set(query, metadataFilters = {}, candidates = [], categories = [], kbVersion = "1", institution = "all", topK = null, ttl = null) {
        if (!query || !Array.isArray(candidates) || candidates.length === 0) return false;
        const key = this._buildKey(query, metadataFilters, kbVersion, institution, topK);

        const retrievedChunkIds = candidates.map(c => String(c.id || c.chunkId || c.metadata?.chunkId || c._id || "")).filter(Boolean);
        const topScore = candidates.length > 0 ? (candidates[0].score || candidates[0].baseScore || candidates[0].rerankScore || 0) : 0;

        const payload = {
            query,
            metadataFilters,
            retrievedChunkIds,
            retrievalScore: topScore,
            candidates,
            cachedAt: new Date().toISOString()
        };

        const cats = Array.isArray(categories) ? categories : (categories ? [categories] : []);
        return this.cache.set(key, payload, ttl, cats);
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
            layer: 6,
            name: "Layer 6 — Retriever Cache",
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

module.exports = new Layer6_RetrieverCache();
