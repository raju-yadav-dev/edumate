/**
 * Layer 2 — Prompt / Query Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache normalized query plans & metadata filter extractions
 * - Cache intent detection & categorization results
 * - Cache pre-compiled system prompts and template expansions
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer2_PromptQueryCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER2_TTL || 1800); // 30 minutes
        const maxEntries = Number(process.env.CACHE_LAYER2_MAX || 600);

        this.queryPlanCache = new BaseLRUCache({
            name: "Layer2_QueryPlans",
            maxEntries,
            defaultTtlSeconds: ttl
        });

        this.promptCache = new BaseLRUCache({
            name: "Layer2_SystemPrompts",
            maxEntries: 200,
            defaultTtlSeconds: ttl * 2 // 1 hour
        });
    }

    _hashQuery(query) {
        return crypto
            .createHash("sha256")
            .update(String(query || "").toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " "))
            .digest("hex")
            .slice(0, 24);
    }

    getQueryPlan(question) {
        if (!question) return null;
        const key = `qplan:${this._hashQuery(question)}`;
        return this.queryPlanCache.get(key);
    }

    setQueryPlan(question, queryPlan, ttl = null) {
        if (!question || !queryPlan) return;
        const key = `qplan:${this._hashQuery(question)}`;
        const categories = queryPlan.category ? [queryPlan.category] : [];
        this.queryPlanCache.set(key, queryPlan, ttl, categories);
    }

    getSystemPrompt(templateKey, params = {}) {
        if (!templateKey) return null;
        const paramsHash = crypto.createHash("md5").update(JSON.stringify(params)).digest("hex").slice(0, 12);
        const key = `prompt:${templateKey}:${paramsHash}`;
        return this.promptCache.get(key);
    }

    setSystemPrompt(templateKey, params = {}, promptText, ttl = null) {
        if (!templateKey || !promptText) return;
        const paramsHash = crypto.createHash("md5").update(JSON.stringify(params)).digest("hex").slice(0, 12);
        const key = `prompt:${templateKey}:${paramsHash}`;
        this.promptCache.set(key, promptText, ttl);
    }

    invalidateCategory(category) {
        return this.queryPlanCache.invalidateCategory(category);
    }

    clear() {
        this.queryPlanCache.clear();
        this.promptCache.clear();
    }

    getStats() {
        const qpStats = this.queryPlanCache.getStats();
        const prStats = this.promptCache.getStats();

        const totalHits = qpStats.hits + prStats.hits;
        const totalMisses = qpStats.misses + prStats.misses;
        const totalOps = totalHits + totalMisses;
        const hitRatePct = totalOps > 0 ? Number(((totalHits / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = qpStats.memoryBytes + prStats.memoryBytes;

        return {
            layer: 2,
            name: "Layer 2 — Prompt / Query Cache",
            size: qpStats.size + prStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            evictions: qpStats.evictions + prStats.evictions,
            avgLookupTimeMs: Number(((qpStats.avgLookupTimeMs + prStats.avgLookupTimeMs) / 2).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.queryPlanCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer2_PromptQueryCache();
