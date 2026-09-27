/**
 * Layer 5 — Document / Chunk Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Cache parsed document chunk arrays from local disk storage
 * - Cache individual chunk lookups by chunkId
 * - Invalidate cached chunks when documents are rechunked, updated, or deleted
 */

const BaseLRUCache = require("./BaseLRUCache");

class Layer5_DocumentChunkCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER5_TTL || 3600); // 1 hour
        const maxEntries = Number(process.env.CACHE_LAYER5_MAX || 1000);

        this.docChunksCache = new BaseLRUCache({
            name: "Layer5_DocChunks",
            maxEntries,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });

        this.singleChunkCache = new BaseLRUCache({
            name: "Layer5_SingleChunks",
            maxEntries: maxEntries * 5,
            defaultTtlSeconds: ttl,
            enableCategoryTracking: true
        });
    }

    getDocumentChunks(documentId) {
        if (!documentId) return null;
        const key = `doc_chunks:${String(documentId)}`;
        return this.docChunksCache.get(key);
    }

    setDocumentChunks(documentId, chunks = [], category = null, ttl = null) {
        if (!documentId || !Array.isArray(chunks)) return false;
        const key = `doc_chunks:${String(documentId)}`;
        const categories = category ? [category] : [];

        // Store full document chunk array
        this.docChunksCache.set(key, chunks, ttl, categories);

        // Also index individual chunks for superfast single lookups
        for (const chunk of chunks) {
            const chunkId = chunk.chunkId || chunk.id || chunk.metadata?.chunkId;
            if (chunkId) {
                const singleKey = `chunk:${String(documentId)}:${String(chunkId)}`;
                this.singleChunkCache.set(singleKey, chunk, ttl, categories);
            }
        }

        return true;
    }

    getChunk(documentId, chunkId) {
        if (!documentId || !chunkId) return null;
        const singleKey = `chunk:${String(documentId)}:${String(chunkId)}`;
        const cached = this.singleChunkCache.get(singleKey);
        if (cached) return cached;

        // Fallback to checking document chunks if loaded
        const docChunks = this.getDocumentChunks(documentId);
        if (docChunks) {
            const match = docChunks.find(c => (c.chunkId === chunkId || c.id === chunkId || c.metadata?.chunkId === chunkId));
            if (match) {
                this.singleChunkCache.set(singleKey, match);
                return match;
            }
        }

        return null;
    }

    invalidateDocument(documentId) {
        if (!documentId) return;
        const safeDocId = String(documentId);
        this.docChunksCache.delete(`doc_chunks:${safeDocId}`);

        // Clean any single chunk entries for this doc
        for (const key of this.singleChunkCache.store.keys()) {
            if (key.startsWith(`chunk:${safeDocId}:`)) {
                this.singleChunkCache.delete(key);
            }
        }
    }

    invalidateCategory(category) {
        const dCount = this.docChunksCache.invalidateCategory(category);
        const sCount = this.singleChunkCache.invalidateCategory(category);
        return dCount + sCount;
    }

    clear() {
        this.docChunksCache.clear();
        this.singleChunkCache.clear();
    }

    getStats() {
        const docStats = this.docChunksCache.getStats();
        const singleStats = this.singleChunkCache.getStats();

        const totalHits = docStats.hits + singleStats.hits;
        const totalMisses = docStats.misses + singleStats.misses;
        const totalOps = totalHits + totalMisses;
        const hitRatePct = totalOps > 0 ? Number(((totalHits / totalOps) * 100).toFixed(2)) : 0;
        const memoryBytes = docStats.memoryBytes + singleStats.memoryBytes;

        return {
            layer: 5,
            name: "Layer 5 — Document / Chunk Cache",
            size: docStats.size + singleStats.size,
            hits: totalHits,
            misses: totalMisses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            evictions: docStats.evictions + singleStats.evictions,
            avgLookupTimeMs: Number(((docStats.avgLookupTimeMs + singleStats.avgLookupTimeMs) / 2).toFixed(3)),
            memoryBytes,
            memoryFormatted: this.docChunksCache._formatBytes(memoryBytes),
            status: "healthy"
        };
    }
}

module.exports = new Layer5_DocumentChunkCache();
