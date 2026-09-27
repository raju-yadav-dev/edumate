/**
 * Layer 2 — Prompt Cache / Query Planner Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache query planner & router outputs (intent, entities, metadata, routing mode, response layout)
 * - Key: Deterministic SHA-256 hash of normalized user question
 * - Pre-compiled system prompts and template expansions
 * - TTL: 1 hour (3600 seconds)
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");

class Layer2_PromptQueryCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER2_TTL || 3600); // 1 hour TTL per Mission 17
        const maxEntries = Number(process.env.CACHE_LAYER2_MAX || 1000);

        this.queryPlanCache = new BaseLRUCache({
            name: "Layer2_QueryPlans",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });

        this.promptCache = new BaseLRUCache({
            name: "Layer2_SystemPrompts",
            maxEntries: 300,
            defaultTtlSeconds: ttl
        });
    }

    _normalizeQuestion(question) {
        return String(question || "")
            .trim()
            .toLowerCase()
            .normalize("NFC")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .replace(/\s+/g, " ");
    }

    _hashQuery(question) {
        const normalized = this._normalizeQuestion(question);
        return crypto.createHash("sha256").update(normalized).digest("hex");
    }

    /**
     * Retrieves cached query planner / router output
     */
    getQueryPlan(question) {
        if (!question) return null;
        const key = `qplan:${this._hashQuery(question)}`;
        return this.queryPlanCache.get(key);
    }

    /**
     * Stores query planner / router output:
     * { intent, entities, metadata, routingMode, responseLayout, ... }
     */
    setQueryPlan(question, queryPlan, ttl = null) {
        if (!question || !queryPlan) return false;
        const key = `qplan:${this._hashQuery(question)}`;
        const categories = queryPlan.category ? [queryPlan.category] : [];
        return this.queryPlanCache.set(key, queryPlan, ttl, categories);
    }

    getSystemPrompt(templateKey, params = {}) {
        if (!templateKey) return null;
        const sortedParams = Object.keys(params).sort().reduce((acc, k) => {
            acc[k] = params[k];
            return acc;
        }, {});
        const paramsHash = crypto.createHash("sha256").update(JSON.stringify(sortedParams)).digest("hex").slice(0, 16);
        const key = `prompt:${templateKey}:${paramsHash}`;
        return this.promptCache.get(key);
    }

    setSystemPrompt(templateKey, params = {}, promptText, ttl = null) {
        if (!templateKey || !promptText) return false;
        const sortedParams = Object.keys(params).sort().reduce((acc, k) => {
            acc[k] = params[k];
            return acc;
        }, {});
        const paramsHash = crypto.createHash("sha256").update(JSON.stringify(sortedParams)).digest("hex").slice(0, 16);
        const key = `prompt:${templateKey}:${paramsHash}`;
        return this.promptCache.set(key, promptText, ttl);
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
        const missRatePct = totalOps > 0 ? Number(((totalMisses / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = qpStats.memoryBytes + prStats.memoryBytes;

        return {
            layer: 2,
            name: "Layer 2 — Prompt Cache",
            size: qpStats.size + prStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            missRate: `${missRatePct}%`,
            missRatePercent: missRatePct,
            evictions: qpStats.evictions + prStats.evictions,
            avgLookupTimeMs: Number(((qpStats.avgLookupTimeMs + prStats.avgLookupTimeMs) / 2).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.queryPlanCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer2_PromptQueryCache();
