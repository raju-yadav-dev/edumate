/**
 * Layer 7 — LLM Response Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache complete generated LLM responses (answer, citations, format, confidence)
 * - Key: Deterministic SHA-256 hash of normalized prompt + routing mode + context hash
 * - TTL: 30 minutes (1800 seconds per Mission 17)
 * - Do not cache streaming tokens — cache only final response
 * - Synchronize to Layer 10 Persistent Disk Cache
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");
const layer10PersistentDiskCache = require("./Layer10_PersistentDiskCache");

class Layer7_LLMResponseCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER7_TTL || 1800); // 30 minutes per Mission 17
        const maxEntries = Number(process.env.CACHE_LAYER7_MAX || 1000);

        this.defaultTtl = ttl;

        this.cache = new BaseLRUCache({
            name: "Layer7_LLMResponses",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });

        this.llmCallsAvoided = 0;
        this.diskSyncEnabled = true;
    }

    _normalizePrompt(prompt) {
        return String(prompt || "")
            .trim()
            .toLowerCase()
            .normalize("NFC")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .replace(/\s+/g, " ");
    }

    _buildKey(prompt, routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all", kbVersion = "1") {
        const normalized = this._normalizePrompt(prompt);
        const promptHash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
        const mode = String(routingMode || "RAG_LLM").toUpperCase();
        const ctx = String(contextHash || "nocontext").slice(0, 16);
        const t = documentType || "all";
        const d = department || "all";

        return `llm_resp:v1:kb${kbVersion}:${mode}:${t}:${d}:${ctx}:${promptHash}`;
    }

    get(prompt, routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all", kbVersion = "1") {
        if (!prompt) return null;
        const key = this._buildKey(prompt, routingMode, contextHash, documentType, department, kbVersion);

        // 1. In-memory LRU
        const mem = this.cache.get(key);
        if (mem) {
            this.llmCallsAvoided++;
            return mem;
        }

        // 2. Layer 10 Disk Cache
        if (this.diskSyncEnabled) {
            const diskVal = layer10PersistentDiskCache.get("responses", key);
            if (diskVal) {
                this.cache.set(key, diskVal, this.defaultTtl);
                this.llmCallsAvoided++;
                return diskVal;
            }
        }

        return null;
    }

    set(prompt, value, categories = [], routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all", kbVersion = "1", customTtl = null) {
        if (!prompt || !value) return false;
        const key = this._buildKey(prompt, routingMode, contextHash, documentType, department, kbVersion);
        const ttl = customTtl !== null ? customTtl : this.defaultTtl;
        const cats = Array.isArray(categories) ? categories : (categories ? [categories] : []);

        const ok = this.cache.set(key, value, ttl, cats);

        if (ok && this.diskSyncEnabled) {
            layer10PersistentDiskCache.set("responses", key, value, ttl, cats);
        }

        return ok;
    }

    del(prompt, routingMode = "RAG_LLM", contextHash = "nocontext", documentType = "all", department = "all", kbVersion = "1") {
        const key = this._buildKey(prompt, routingMode, contextHash, documentType, department, kbVersion);
        if (this.diskSyncEnabled) {
            layer10PersistentDiskCache.delete("responses", key);
        }
        return this.cache.delete(key);
    }

    invalidateCategory(category) {
        return this.cache.invalidateCategory(category);
    }

    clear() {
        if (this.diskSyncEnabled) {
            layer10PersistentDiskCache.clear("responses");
        }
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
