/**
 * Layer 5 — Document Chunk Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Cache parsed document chunks (chunk JSON, hierarchy, page metadata, keywords, entities)
 * - Read directly from disk cache (`storage/cache/chunks/` & `storage/chunks/`)
 * - Never reread or reparse PDFs if chunk cache exists
 * - Invalidation when documents are rechunked, regenerated, updated, or deleted
 */

const fs = require("fs");
const path = require("path");
const BaseLRUCache = require("./BaseLRUCache");
const layer10PersistentDiskCache = require("./Layer10_PersistentDiskCache");
const localStorageManager = require("../../storage/localStorageManager");

class Layer5_DocumentChunkCache {
    constructor() {
        const ttl = Number(process.env.CACHE_LAYER5_TTL || 86400 * 30); // 30 days default (persistent chunks)
        const maxEntries = Number(process.env.CACHE_LAYER5_MAX || 2000);

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

        this.chunksDiskDir = path.join(localStorageManager.STORAGE_ROOT, "chunks");
    }

    getDocumentChunks(documentId) {
        if (!documentId) return null;
        const safeDocId = String(documentId);
        const key = `doc_chunks:${safeDocId}`;

        // 1. In-memory LRU
        const mem = this.docChunksCache.get(key);
        if (mem && Array.isArray(mem)) {
            return mem;
        }

        // 2. Layer 10 Disk Cache
        const diskL10 = layer10PersistentDiskCache.get("chunks", safeDocId);
        if (diskL10 && Array.isArray(diskL10)) {
            this.setDocumentChunks(safeDocId, diskL10);
            return diskL10;
        }

        // 3. Storage chunks directory fallback
        const chunkFilePath = path.join(this.chunksDiskDir, `${safeDocId}.chunks.json`);
        if (fs.existsSync(chunkFilePath)) {
            try {
                const raw = fs.readFileSync(chunkFilePath, "utf-8");
                const data = JSON.parse(raw);
                const chunkList = Array.isArray(data) ? data : (data.chunks || []);
                if (chunkList.length > 0) {
                    this.setDocumentChunks(safeDocId, chunkList);
                    return chunkList;
                }
            } catch (_) {}
        }

        return null;
    }

    setDocumentChunks(documentId, chunks = [], category = null, ttl = null) {
        if (!documentId || !Array.isArray(chunks)) return false;
        const safeDocId = String(documentId);
        const key = `doc_chunks:${safeDocId}`;
        const categories = category ? [category] : [];

        // Store full document chunk array in-memory
        this.docChunksCache.set(key, chunks, ttl, categories);

        // Store into Layer 10 Persistent Disk Cache
        layer10PersistentDiskCache.set("chunks", safeDocId, chunks, ttl || 0, categories);

        // Also index individual chunks for single chunk lookups
        for (const chunk of chunks) {
            const chunkId = chunk.chunkId || chunk.id || chunk.metadata?.chunkId;
            if (chunkId) {
                const singleKey = `chunk:${safeDocId}:${String(chunkId)}`;
                this.singleChunkCache.set(singleKey, chunk, ttl, categories);
            }
        }

        return true;
    }

    getChunk(documentId, chunkId) {
        if (!documentId || !chunkId) return null;
        const safeDocId = String(documentId);
        const safeChunkId = String(chunkId);
        const singleKey = `chunk:${safeDocId}:${safeChunkId}`;

        const cached = this.singleChunkCache.get(singleKey);
        if (cached) return cached;

        // Fallback to full document chunk list
        const docChunks = this.getDocumentChunks(safeDocId);
        if (docChunks && Array.isArray(docChunks)) {
            const match = docChunks.find(c => (c.chunkId === safeChunkId || c.id === safeChunkId || c.metadata?.chunkId === safeChunkId));
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
        layer10PersistentDiskCache.delete("chunks", safeDocId);

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
            name: "Layer 5 — Document Chunk Cache",
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
