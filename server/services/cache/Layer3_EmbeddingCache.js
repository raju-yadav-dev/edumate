/**
 * Layer 3 — Embedding Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache generated embeddings for queries and chunk text
 * - Key: Deterministic SHA-256 hash of cleaned text
 * - Never regenerate embeddings for identical chunk text
 * - Store locally in-memory (LRU) and synchronize with Layer 10 Persistent Disk Cache
 * - TTL: Infinite (0) unless chunk text changes or model updates
 */

const crypto = require("crypto");
const BaseLRUCache = require("./BaseLRUCache");
const layer10PersistentDiskCache = require("./Layer10_PersistentDiskCache");

class Layer3_EmbeddingCache {
    constructor() {
        // Infinite TTL by default (represented as 0 or large value in seconds)
        const ttl = Number(process.env.CACHE_LAYER3_TTL || 0);
        const maxEntries = Number(process.env.CACHE_LAYER3_MAX || 20000);

        this.cache = new BaseLRUCache({
            name: "Layer3_Embeddings",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });

        this.diskSyncEnabled = true;
    }

    _normalizeText(text) {
        return String(text || "")
            .trim()
            .normalize("NFC")
            .replace(/\r\n/g, "\n")
            .replace(/\s+/g, " ");
    }

    _hashText(text) {
        const clean = this._normalizeText(text);
        return crypto.createHash("sha256").update(clean).digest("hex");
    }

    _buildKey(text, options = {}) {
        const provider = options.provider || process.env.EMBEDDING_PROVIDER || "jina";
        const model = options.model || process.env.EMBEDDING_MODEL || "jina-embeddings-v3";
        const task = options.task || "retrieval.passage";
        const dimensions = options.dimensions || 768;
        const textHash = this._hashText(text);

        return `emb:${provider}:${model}:${task}:${dimensions}:${textHash}`;
    }

    getEmbedding(text, options = {}) {
        if (!text || typeof text !== "string") return null;
        const key = this._buildKey(text, options);

        // 1. In-memory LRU lookup
        const mem = this.cache.get(key);
        if (mem) {
            return mem;
        }

        // 2. Persistent Disk Cache fallback
        if (this.diskSyncEnabled) {
            const diskVal = layer10PersistentDiskCache.get("embeddings", key);
            if (diskVal && Array.isArray(diskVal)) {
                this.cache.set(key, diskVal, options.ttl || null, options.categories || []);
                return diskVal;
            }
        }

        return null;
    }

    setEmbedding(text, vector, options = {}, categories = []) {
        if (!text || !Array.isArray(vector) || vector.length === 0) return false;
        const key = this._buildKey(text, options);
        const ttl = options.ttl !== undefined ? options.ttl : null;

        // In-memory set
        const ok = this.cache.set(key, vector, ttl, categories);

        // Synchronize to Layer 10 Disk Cache
        if (ok && this.diskSyncEnabled) {
            layer10PersistentDiskCache.set("embeddings", key, vector, ttl || 0, categories);
        }

        return ok;
    }

    getBatchEmbeddings(texts = [], options = {}) {
        if (!Array.isArray(texts) || texts.length === 0) return { results: [], missingIndices: [], allFound: true };
        const results = new Array(texts.length).fill(null);
        const missingIndices = [];

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
