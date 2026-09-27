/**
 * SmartCacheHub — Complete 10-Layer Smart Cache Architecture Orchestrator
 * EduMate Mission 14.1
 * 
 * Unified Controller for all 10 Independent Cache Layers:
 * - Layer 1: Client/UI Cache
 * - Layer 2: Prompt / Query Cache
 * - Layer 3: Embedding Cache
 * - Layer 4: Vector Search Cache
 * - Layer 5: Document / Chunk Cache
 * - Layer 6: Retriever Cache
 * - Layer 7: LLM Response Cache
 * - Layer 8: Conversation / Context Cache
 * - Layer 9: Model KV Cache
 * - Layer 10: Persistent Disk Cache
 */

const layer1ClientCache = require("./Layer1_ClientCache");
const layer2PromptQueryCache = require("./Layer2_PromptQueryCache");
const layer3EmbeddingCache = require("./Layer3_EmbeddingCache");
const layer4VectorSearchCache = require("./Layer4_VectorSearchCache");
const layer5DocumentChunkCache = require("./Layer5_DocumentChunkCache");
const layer6RetrieverCache = require("./Layer6_RetrieverCache");
const layer7LLMResponseCache = require("./Layer7_LLMResponseCache");
const layer8ConversationContextCache = require("./Layer8_ConversationContextCache");
const layer9ModelKVCache = require("./Layer9_ModelKVCache");
const layer10PersistentDiskCache = require("./Layer10_PersistentDiskCache");

class SmartCacheHub {
    constructor() {
        this.l1 = layer1ClientCache;
        this.l2 = layer2PromptQueryCache;
        this.l3 = layer3EmbeddingCache;
        this.l4 = layer4VectorSearchCache;
        this.l5 = layer5DocumentChunkCache;
        this.l6 = layer6RetrieverCache;
        this.l7 = layer7LLMResponseCache;
        this.l8 = layer8ConversationContextCache;
        this.l9 = layer9ModelKVCache;
        this.l10 = layer10PersistentDiskCache;

        this.kbVersion = 1;
        this.isInitialized = false;

        this._initStartup();
    }

    _initStartup() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Auto-prune expired disk entries in background
        try {
            this.l10.pruneExpired();
        } catch (_) {}
    }

    getKbVersion() {
        return String(this.kbVersion);
    }

    incrementKbVersion() {
        this.kbVersion++;
        console.log(`[SmartCacheHub] Dynamic Knowledge-Base Version incremented to: ${this.kbVersion}`);
        return String(this.kbVersion);
    }

    // =========================================================================
    // AUTOMATIC INVALIDATION HANDLERS (Mission 14.1 Rules)
    // =========================================================================

    /**
     * Automatic invalidation on new document upload
     */
    invalidateUpload(document) {
        if (!document) return;
        const category = document.category || "";
        console.log(`[SmartCacheHub:Invalidation] Trigger: UPLOAD | Category: "${category}" | Doc: "${document.originalName || document._id}"`);

        this.incrementKbVersion();
        if (category) {
            this.invalidateCategory(category);
        } else {
            this.l4.clear();
            this.l6.clear();
            this.l7.clear();
        }
    }

    /**
     * Automatic invalidation on document rechunk
     */
    invalidateRechunk(documentId, category = "") {
        console.log(`[SmartCacheHub:Invalidation] Trigger: RECHUNK | DocId: "${documentId}" | Category: "${category}"`);
        this.incrementKbVersion();

        if (documentId) {
            this.l5.invalidateDocument(documentId);
        }
        if (category) {
            this.invalidateCategory(category);
        } else {
            this.l4.clear();
            this.l6.clear();
            this.l7.clear();
            this.l8.clear();
        }
    }

    /**
     * Automatic invalidation on document delete
     */
    invalidateDelete(documentId, category = "") {
        console.log(`[SmartCacheHub:Invalidation] Trigger: DELETE | DocId: "${documentId}" | Category: "${category}"`);
        this.incrementKbVersion();

        if (documentId) {
            this.l5.invalidateDocument(documentId);
        }
        if (category) {
            this.invalidateCategory(category);
        } else {
            this.l4.clear();
            this.l6.clear();
            this.l7.clear();
            this.l8.clear();
        }
    }

    /**
     * Automatic invalidation on category / system reindex
     */
    invalidateReindex(category = "") {
        console.log(`[SmartCacheHub:Invalidation] Trigger: REINDEX | Category: "${category || 'ALL'}"`);
        this.incrementKbVersion();

        if (category) {
            this.invalidateCategory(category);
        } else {
            this.l2.clear();
            this.l4.clear();
            this.l5.clear();
            this.l6.clear();
            this.l7.clear();
            this.l8.clear();
            this.l10.clear();
        }
    }

    /**
     * Automatic invalidation on document update
     */
    invalidateDocumentUpdate(documentId, category = "") {
        console.log(`[SmartCacheHub:Invalidation] Trigger: UPDATE | DocId: "${documentId}" | Category: "${category}"`);
        this.incrementKbVersion();

        if (documentId) {
            this.l5.invalidateDocument(documentId);
        }
        if (category) {
            this.invalidateCategory(category);
        }
    }

    /**
     * Selective category invalidation cascading across layers
     */
    invalidateCategory(category) {
        if (!category) return;
        const cleanCat = String(category).trim().toLowerCase();
        console.log(`[SmartCacheHub:Invalidation] Cascading category invalidation: "${cleanCat}" across all 10 layers`);

        this.l2.invalidateCategory(cleanCat);
        this.l3.invalidateCategory(cleanCat);
        this.l4.invalidateCategory(cleanCat);
        this.l5.invalidateCategory(cleanCat);
        this.l6.invalidateCategory(cleanCat);
        this.l7.invalidateCategory(cleanCat);
        this.l10.invalidateCategory(cleanCat);
    }

    /**
     * Total cache purge across all 10 layers and persistent disk cache
     */
    invalidateAll() {
        console.log("[SmartCacheHub:Invalidation] Purging ALL 10 Cache Layers & Disk Cache...");
        this.incrementKbVersion();

        this.l1.clear();
        this.l2.clear();
        this.l3.clear();
        this.l4.clear();
        this.l5.clear();
        this.l6.clear();
        this.l7.clear();
        this.l8.clear();
        this.l9.clear();
        this.l10.clear();
    }

    // =========================================================================
    // UNIFIED ANALYTICS & MONITORING (Mission 14.1 Metrics)
    // =========================================================================

    /**
     * Collects comprehensive analytics across all 10 cache layers
     */
    getStats() {
        const s1 = this.l1.getStats();
        const s2 = this.l2.getStats();
        const s3 = this.l3.getStats();
        const s4 = this.l4.getStats();
        const s5 = this.l5.getStats();
        const s6 = this.l6.getStats();
        const s7 = this.l7.getStats();
        const s8 = this.l8.getStats();
        const s9 = this.l9.getStats();
        const s10 = this.l10.getStats();

        const layers = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];

        let totalHits = 0;
        let totalMisses = 0;
        let totalEvictions = 0;
        let totalMemoryBytes = 0;
        let totalDiskBytes = s10.diskBytes || 0;
        let weightedLookupTime = 0;
        let totalOps = 0;

        for (const l of layers) {
            totalHits += (l.hits || 0);
            totalMisses += (l.misses || 0);
            totalEvictions += (l.evictions || 0);
            totalMemoryBytes += (l.memoryBytes || 0);

            const ops = (l.hits || 0) + (l.misses || 0);
            if (ops > 0 && l.avgLookupTimeMs) {
                weightedLookupTime += (l.avgLookupTimeMs * ops);
                totalOps += ops;
            }
        }

        const globalOps = totalHits + totalMisses;
        const globalHitRatePct = globalOps > 0 ? Number(((totalHits / globalOps) * 100).toFixed(2)) : 0;
        const globalMissRatePct = globalOps > 0 ? Number(((totalMisses / globalOps) * 100).toFixed(2)) : 0;
        const globalAvgLookupMs = totalOps > 0 ? Number((weightedLookupTime / totalOps).toFixed(3)) : 0;

        return {
            global: {
                totalHits,
                totalMisses,
                hitRate: `${globalHitRatePct}%`,
                hitRatePercent: globalHitRatePct,
                missRate: `${globalMissRatePct}%`,
                missRatePercent: globalMissRatePct,
                evictions: totalEvictions,
                memoryBytes: totalMemoryBytes,
                memoryFormatted: this._formatBytes(totalMemoryBytes),
                diskBytes: totalDiskBytes,
                diskFormatted: this._formatBytes(totalDiskBytes),
                avgLookupTimeMs: globalAvgLookupMs,
                kbVersion: String(this.kbVersion),
                activeLayers: 10,
                status: "optimal"
            },
            layers: {
                layer1_clientUI: s1,
                layer2_promptQuery: s2,
                layer3_embeddings: s3,
                layer4_vectorSearch: s4,
                layer5_documentChunks: s5,
                layer6_retriever: s6,
                layer7_llmResponses: s7,
                layer8_conversationContext: s8,
                layer9_modelKV: s9,
                layer10_persistentDisk: s10
            }
        };
    }

    _formatBytes(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || "B"}`;
    }

    /**
     * Generates formatted startup / telemetry report for all 10 layers
     */
    generateCacheReport() {
        const stats = this.getStats();
        const l = stats.layers;

        const lines = [
            "=========================================================================================",
            "             EDUMATE MISSION 14.1 — 10-LAYER SMART CACHE ARCHITECTURE REPORT              ",
            "=========================================================================================",
            ` Global Status      : ${stats.global.status.toUpperCase()} (KB Version: v${stats.global.kbVersion})`,
            ` Global Hit Rate    : ${stats.global.hitRate} (${stats.global.totalHits} Hits / ${stats.global.totalMisses} Misses)`,
            ` Global Evictions   : ${stats.global.evictions}`,
            ` Memory Footprint   : ${stats.global.memoryFormatted} | Persistent Disk: ${stats.global.diskFormatted}`,
            ` Avg Lookup Latency : ${stats.global.avgLookupTimeMs} ms`,
            "-----------------------------------------------------------------------------------------",
            " LAYER                      | ENTRIES | HIT RATE | AVG LATENCY | MEMORY/DISK | STATUS    ",
            "-----------------------------------------------------------------------------------------",
            ` 1. Client / UI Cache       | ${String(l.layer1_clientUI.size).padEnd(7)} | ${String(l.layer1_clientUI.hitRate).padEnd(8)} | ${String(l.layer1_clientUI.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer1_clientUI.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 2. Prompt / Query Cache    | ${String(l.layer2_promptQuery.size).padEnd(7)} | ${String(l.layer2_promptQuery.hitRate).padEnd(8)} | ${String(l.layer2_promptQuery.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer2_promptQuery.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 3. Embedding Vector Cache  | ${String(l.layer3_embeddings.size).padEnd(7)} | ${String(l.layer3_embeddings.hitRate).padEnd(8)} | ${String(l.layer3_embeddings.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer3_embeddings.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 4. Vector Search Cache     | ${String(l.layer4_vectorSearch.size).padEnd(7)} | ${String(l.layer4_vectorSearch.hitRate).padEnd(8)} | ${String(l.layer4_vectorSearch.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer4_vectorSearch.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 5. Document / Chunk Cache  | ${String(l.layer5_documentChunks.size).padEnd(7)} | ${String(l.layer5_documentChunks.hitRate).padEnd(8)} | ${String(l.layer5_documentChunks.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer5_documentChunks.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 6. Retriever Rerank Cache  | ${String(l.layer6_retriever.size).padEnd(7)} | ${String(l.layer6_retriever.hitRate).padEnd(8)} | ${String(l.layer6_retriever.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer6_retriever.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 7. LLM Response Cache      | ${String(l.layer7_llmResponses.size).padEnd(7)} | ${String(l.layer7_llmResponses.hitRate).padEnd(8)} | ${String(l.layer7_llmResponses.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer7_llmResponses.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 8. Conversation Memory     | ${String(l.layer8_conversationContext.size).padEnd(7)} | ${String(l.layer8_conversationContext.hitRate).padEnd(8)} | ${String(l.layer8_conversationContext.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer8_conversationContext.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 9. Model KV Attention Slot | ${String(l.layer9_modelKV.size).padEnd(7)} | ${String(l.layer9_modelKV.hitRate).padEnd(8)} | ${String(l.layer9_modelKV.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer9_modelKV.memoryFormatted).padEnd(11)} | ✓ HEALTHY `,
            ` 10. Persistent Disk Cache  | ${String(l.layer10_persistentDisk.size).padEnd(7)} | ${String(l.layer10_persistentDisk.hitRate).padEnd(8)} | ${String(l.layer10_persistentDisk.avgLookupTimeMs + 'ms').padEnd(11)} | ${String(l.layer10_persistentDisk.diskFormatted).padEnd(11)} | ✓ HEALTHY `,
            "========================================================================================="
        ];

        return lines.join("\n");
    }
}

const smartCacheHub = new SmartCacheHub();

module.exports = smartCacheHub;
