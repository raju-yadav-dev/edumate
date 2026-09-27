/**
 * Layer 7 — LLM Response Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache complete generated responses (including citations, formatting, metadata)
 * - Cache by normalized query + documentType + department + queryMode + kbVersion
 * - Fast sub-50ms cache hits for identical inquiries
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer7_LLMResponseCache {
    constructor() {
        const staticTtl = Number(process.env.CACHE_LAYER7_STATIC_TTL || process.env.CACHE_STATIC_TTL || 86400); // 24 hours
        const dynamicTtl = Number(process.env.CACHE_LAYER7_DYNAMIC_TTL || process.env.CACHE_DYNAMIC_TTL || 60);  // 1 minute
        const maxEntries = Number(process.env.CACHE_LAYER7_MAX || 500);

        this.staticTtl = staticTtl;
        this.dynamicTtl = dynamicTtl;

        this.cache = new BaseLRUCache({
            name: "Layer7_LLMResponses",
            maxEntries,
            defaultTtlSeconds: staticTtl,
            enableCategoryTracking: true
        });

        this.llmCallsAvoided = 0;
    }

    _normalizeQuery(query) {
        return String(query || "")
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, "")
            .replace(/\s+/g, " ");
    }

    _buildKey(query, documentType = "all", department = "all", queryMode = "targeted", kbVersion = "1") {
        const normalized = this._normalizeQuery(query);
        const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
        const t = documentType || "all";
        const d = department || "all";
        const m = queryMode || "targeted";
        return `llm_resp:v1:kb${kbVersion}:${t}:${d}:${m}:${hash}`;
    }

    get(query, documentType = "all", department = "all", queryMode = "targeted", kbVersion = "1") {
        if (!query) return null;
        const key = this._buildKey(query, documentType, department, queryMode, kbVersion);
        const val = this.cache.get(key);
        if (val) {
            this.llmCallsAvoided++;
        }
        return val;
    }

    set(query, value, categories = [], isDynamic = false, documentType = "all", department = "all", queryMode = "targeted", kbVersion = "1", customTtl = null) {
        if (!query || !value) return false;
        const key = this._buildKey(query, documentType, department, queryMode, kbVersion);
        const ttl = customTtl !== null ? customTtl : (isDynamic ? this.dynamicTtl : this.staticTtl);
        const cats = Array.isArray(categories) ? categories : (categories ? [categories] : []);
        return this.cache.set(key, value, ttl, cats);
    }

    del(query, documentType = "all", department = "all", queryMode = "targeted", kbVersion = "1") {
        const key = this._buildKey(query, documentType, department, queryMode, kbVersion);
        return this.cache.delete(key);
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
            layer: 7,
            name: "Layer 7 — LLM Response Cache",
            size: stats.size,
            maxEntries: stats.maxEntries,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hitRate,
            hitRatePercent: stats.hitRatePercent,
            missRate: stats.missRate,
            missRatePercent: stats.missRatePercent,
            llmCallsAvoided: this.llmCallsAvoided,
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

module.exports = new Layer7_LLMResponseCache();
