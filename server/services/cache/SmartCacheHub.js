/**
 * SmartCacheHub — Unified Lightweight In-Memory LRU Cache
 * Replaces 10-tier multi-file cache bloat with a fast, single-process LRU.
 */

class SimpleLRU {
    constructor(maxSize = 500, defaultTtlMs = 15 * 60 * 1000) {
        this.maxSize = maxSize;
        this.defaultTtl = defaultTtlMs;
        this.map = new Map();
        this.hits = 0;
        this.misses = 0;
    }

    get(key) {
        if (!key) return null;
        const entry = this.map.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (Date.now() > entry.exp) {
            this.map.delete(key);
            this.misses++;
            return null;
        }
        // Refresh MRU position
        this.map.delete(key);
        this.map.set(key, entry);
        this.hits++;
        return entry.val;
    }

    set(key, val, customTtlMs) {
        if (!key) return;
        const ttl = customTtlMs || this.defaultTtl;
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.maxSize) {
            // Evict oldest
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
        this.map.set(key, { val, exp: Date.now() + ttl });
    }

    del(key) {
        return this.map.delete(key);
    }

    clear() {
        this.map.clear();
        this.hits = 0;
        this.misses = 0;
    }

    get size() {
        return this.map.size;
    }
}

class UnifiedCacheHub {
    constructor() {
        this.kbVersion = Number(process.env.CACHE_VERSION || 1);
        this.totalLatencySavedMs = 0;
        this.savedOpsCount = 0;

        // Shared fast memory caches
        this._llmCache = new SimpleLRU(300, 30 * 60 * 1000);
        this._retrieverCache = new SimpleLRU(300, 15 * 60 * 1000);
        this._chunkCache = new SimpleLRU(500, 60 * 60 * 1000);
        this._contextCache = new SimpleLRU(200, 60 * 60 * 1000);
        this._queryPlanCache = new SimpleLRU(200, 30 * 60 * 1000);
        this._embeddingCache = new SimpleLRU(500, 60 * 60 * 1000);

        // Layer adapters preserving compatibility
        this.l1 = { get: () => null, set: () => {}, clear: () => {} };
        this.l2 = {
            getQueryPlan: (q) => this._queryPlanCache.get(`qp_${q}`),
            setQueryPlan: (q, plan) => this._queryPlanCache.set(`qp_${q}`, plan),
            clear: () => this._queryPlanCache.clear()
        };
        this.l3 = {
            get: (key) => this._embeddingCache.get(key),
            set: (key, val, ttl) => this._embeddingCache.set(key, val, ttl),
            getEmbedding: (text) => this._embeddingCache.get(`emb_${text}`),
            setEmbedding: (text, emb) => this._embeddingCache.set(`emb_${text}`, emb),
            _buildKey: (text) => `emb_${text}`,
            clear: () => this._embeddingCache.clear()
        };
        this.l4 = {
            getVectorSearch: () => null,
            setVectorSearch: () => {},
            clear: () => {}
        };

        // L5: Chunks
        this.l5 = {
            setDocumentChunks: (docId, chunks) => this._chunkCache.set(`doc_${docId}`, chunks),
            getDocumentChunks: (docId) => this._chunkCache.get(`doc_${docId}`),
            getChunk: (docId, chunkId) => {
                const chunks = this._chunkCache.get(`doc_${docId}`);
                return Array.isArray(chunks) ? chunks.find(c => c.chunkId === chunkId) || null : null;
            },
            invalidateDocument: (docId) => this._chunkCache.del(`doc_${docId}`),
            clear: () => this._chunkCache.clear()
        };

        // L6: Retriever
        this.l6 = {
            get: (query) => this._retrieverCache.get(`q_${query}`),
            set: (query, filters, candidates, cat, kb, inst, topK, ttl) => this._retrieverCache.set(`q_${query}`, candidates, ttl),
            clear: () => this._retrieverCache.clear()
        };

        // L7: LLM Response
        this.l7 = {
            get: (query) => this._llmCache.get(`ans_${query}`),
            set: (query, val, cat, mode, hash, docType, dept, kb, ttl) => this._llmCache.set(`ans_${query}`, val, ttl),
            del: (query) => this._llmCache.del(`ans_${query}`),
            clear: () => this._llmCache.clear()
        };

        // L8: Conversation context
        this.l8 = {
            getMergedContext: (chunkIds) => this._contextCache.get(`ctx_${chunkIds?.join("_")}`),
            setMergedContext: (chunkIds, ctx, kb, ttl) => this._contextCache.set(`ctx_${chunkIds?.join("_")}`, ctx, ttl),
            getRecentMemory: (userId, convId) => this._contextCache.get(`mem_${userId}_${convId}`) || [],
            setConversationContext: (userId, convId, data) => this._contextCache.set(`mem_${userId}_${convId}`, data),
            getConversationContext: (userId, convId) => this._contextCache.get(`mem_${userId}_${convId}`),
            clear: () => this._contextCache.clear()
        };

        this.l9 = { recordHit: () => {}, recordMiss: () => {}, clear: () => {} };
        this.l10 = { get: () => null, set: () => {}, pruneExpired: () => {}, clear: () => {} };
    }

    getKbVersion() {
        return this.kbVersion;
    }

    incrementKbVersion() {
        this.kbVersion += 1;
        this.invalidateAll();
        return this.kbVersion;
    }

    recordLatencySaved(savedMs) {
        if (Number(savedMs) > 0) {
            this.totalLatencySavedMs += Number(savedMs);
            this.savedOpsCount += 1;
        }
    }

    invalidateCategory() {
        this.invalidateAll();
    }

    invalidateAll() {
        this._llmCache.clear();
        this._retrieverCache.clear();
        this._chunkCache.clear();
        this._contextCache.clear();
    }

    invalidateUpload() { this.invalidateAll(); }
    invalidateRechunk() { this.invalidateAll(); }
    invalidateDelete() { this.invalidateAll(); }
    invalidateReindex() { this.invalidateAll(); }
    invalidateDocumentUpdate() { this.invalidateAll(); }
    invalidateEmbeddingModelChange() { this.invalidateAll(); }
    invalidateLLMModelChange() { this.invalidateAll(); }
    warmStartupCache() {}

    getStats() {
        const totalHits = this._llmCache.hits + this._retrieverCache.hits + this._chunkCache.hits;
        const totalMisses = this._llmCache.misses + this._retrieverCache.misses + this._chunkCache.misses;
        const total = totalHits + totalMisses;
        const hitRate = total > 0 ? ((totalHits / total) * 100).toFixed(1) + "%" : "0%";

        return {
            global: {
                totalHits,
                totalMisses,
                hitRate,
                totalSize: this._llmCache.size + this._retrieverCache.size + this._chunkCache.size,
                totalLatencySavedMs: this.totalLatencySavedMs
            },
            layers: {
                l5_chunks: { size: this._chunkCache.size, hits: this._chunkCache.hits },
                l6_retriever: { size: this._retrieverCache.size, hits: this._retrieverCache.hits },
                l7_llm: { size: this._llmCache.size, hits: this._llmCache.hits },
                l8_context: { size: this._contextCache.size }
            }
        };
    }

    generateCacheReport() {
        return {
            timestamp: new Date().toISOString(),
            status: "HEALTHY",
            stats: this.getStats()
        };
    }
}

module.exports = new UnifiedCacheHub();
