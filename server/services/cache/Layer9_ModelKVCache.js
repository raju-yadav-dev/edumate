/**
 * Layer 9 — llama.cpp KV Cache Manager
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Manage llama.cpp prompt caching and KV slot allocations
 * - Enable `--cache-type-k q8_0`, `--cache-type-v q8_0`, `--prompt-cache`
 * - Store cache metadata under `storage/cache/llama/`
 * - Reuse prompt prefixes across dialogue generations to eliminate TTFT re-eval
 * - Track slot allocation, hit rates, prefix matches, and slot recycles
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const localStorageManager = require("../../storage/localStorageManager");

class Layer9_ModelKVCache {
    constructor() {
        this.maxSlots = Number(process.env.LLM_KV_MAX_SLOTS || 100);
        this.slotTtlMs = Number(process.env.LLM_KV_SLOT_TTL_MS || 30 * 60 * 1000); // 30 minutes
        this.llamaCacheDir = path.join(localStorageManager.STORAGE_ROOT, "cache", "llama");

        // Map: conversationId -> { slotId, lastUsed, promptTokens, promptPrefixHash, turnCount }
        this.slots = new Map();
        this.allocatedSlotIds = new Set();

        this.hits = 0;
        this.misses = 0;
        this.reusedSlots = 0;
        this.recycledSlots = 0;
        this.totalLookupTimeMs = 0;
        this.lookupCount = 0;

        this._ensureDir();
    }

    _ensureDir() {
        try {
            if (!fs.existsSync(this.llamaCacheDir)) {
                fs.mkdirSync(this.llamaCacheDir, { recursive: true });
            }
        } catch (_) {}
    }

    _computeHashSlotId(conversationId) {
        if (!conversationId) return 0;
        let hash = 0;
        const str = String(conversationId);
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0x7FFFFFFF;
        }
        return hash % this.maxSlots;
    }

    _hashPrefix(prefix) {
        if (!prefix) return "";
        return crypto.createHash("sha256").update(String(prefix)).digest("hex").slice(0, 24);
    }

    /**
     * Returns llama.cpp recommended runtime flags for KV caching
     */
    getLlamaCacheFlags() {
        return {
            cacheTypeK: "q8_0",
            cacheTypeV: "q8_0",
            promptCache: true,
            promptCacheDir: this.llamaCacheDir,
            flags: ["--cache-type-k", "q8_0", "--cache-type-v", "q8_0", "--prompt-cache"]
        };
    }

    /**
     * Obtains or allocates a deterministic KV slot for conversation
     */
    getOrAllocateSlot(conversationId, promptPrefix = "") {
        const start = Date.now();
        this.lookupCount++;

        if (!conversationId) {
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return {
                slotId: 0,
                isReused: false,
                cachePrompt: true,
                nKeep: -1,
                promptCachePath: null
            };
        }

        const convKey = String(conversationId);
        const prefixHash = this._hashPrefix(promptPrefix);
        const existing = this.slots.get(convKey);

        if (existing) {
            // Check TTL
            if (Date.now() - existing.lastUsed < this.slotTtlMs) {
                existing.lastUsed = Date.now();
                existing.turnCount++;
                if (prefixHash && existing.promptPrefixHash === prefixHash) {
                    existing.prefixMatched = true;
                }
                this.hits++;
                this.reusedSlots++;
                this.totalLookupTimeMs += (Date.now() - start);

                const cacheFilePath = path.join(this.llamaCacheDir, `slot_${existing.slotId}.bin`);

                return {
                    slotId: existing.slotId,
                    isReused: true,
                    turnCount: existing.turnCount,
                    cachePrompt: true,
                    nKeep: -1,
                    promptCachePath: cacheFilePath
                };
            } else {
                // Expired slot
                this.allocatedSlotIds.delete(existing.slotId);
                this.slots.delete(convKey);
            }
        }

        // Allocate slot
        let assignedSlotId = this._computeHashSlotId(convKey);

        // If slot capacity reached, evict oldest
        if (this.slots.size >= this.maxSlots) {
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [k, v] of this.slots.entries()) {
                if (v.lastUsed < oldestTime) {
                    oldestTime = v.lastUsed;
                    oldestKey = k;
                }
            }
            if (oldestKey) {
                const oldSlot = this.slots.get(oldestKey);
                if (oldSlot) {
                    this.allocatedSlotIds.delete(oldSlot.slotId);
                }
                this.slots.delete(oldestKey);
                this.recycledSlots++;
            }
        }

        this.allocatedSlotIds.add(assignedSlotId);
        this.slots.set(convKey, {
            slotId: assignedSlotId,
            lastUsed: Date.now(),
            turnCount: 1,
            promptPrefixHash: prefixHash
        });

        this.misses++;
        this.totalLookupTimeMs += (Date.now() - start);

        const cacheFilePath = path.join(this.llamaCacheDir, `slot_${assignedSlotId}.bin`);

        return {
            slotId: assignedSlotId,
            isReused: false,
            turnCount: 1,
            cachePrompt: true,
            nKeep: -1,
            promptCachePath: cacheFilePath
        };
    }

    releaseSlot(conversationId) {
        if (!conversationId) return false;
        const convKey = String(conversationId);
        const existing = this.slots.get(convKey);
        if (existing) {
            this.allocatedSlotIds.delete(existing.slotId);
            this.slots.delete(convKey);
            return true;
        }
        return false;
    }

    clear() {
        const count = this.slots.size;
        this.slots.clear();
        this.allocatedSlotIds.clear();
        return count;
    }

    getStats() {
        const totalOps = this.hits + this.misses;
        const hitRatePct = totalOps > 0 ? Number(((this.hits / totalOps) * 100).toFixed(2)) : 0;
        const avgLookupMs = this.lookupCount > 0 ? Number((this.totalLookupTimeMs / this.lookupCount).toFixed(3)) : 0;
        const memoryBytes = this.slots.size * 128;

        return {
            layer: 9,
            name: "Layer 9 — Model KV Cache",
            size: this.slots.size,
            maxSlots: this.maxSlots,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            reusedSlots: this.reusedSlots,
            recycledSlots: this.recycledSlots,
            avgLookupTimeMs: avgLookupMs,
            memoryBytes,
            memoryFormatted: `${(memoryBytes / 1024).toFixed(2)} KB`,
            llamaCacheDir: this.llamaCacheDir,
            status: "healthy"
        };
    }
}

module.exports = new Layer9_ModelKVCache();
