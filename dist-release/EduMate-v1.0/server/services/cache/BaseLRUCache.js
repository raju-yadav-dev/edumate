/**
 * BaseLRUCache — High-Performance In-Memory LRU Cache with TTL & Category Invalidation
 * EduMate Mission 14.1
 */

class BaseLRUCache {
    constructor({
        name = "BaseCache",
        maxEntries = 500,
        defaultTtlSeconds = 600,
        enableCategoryTracking = true
    } = {}) {
        this.name = name;
        this.maxEntries = Number(maxEntries) || 500;
        this.defaultTtlSeconds = Number(defaultTtlSeconds) || 600;
        this.enableCategoryTracking = enableCategoryTracking;

        this.store = new Map(); // key -> { value, expiry, createdAt, lastAccessed, sizeEstimate, categories }
        this.categoryIndex = new Map(); // category -> Set<key>

        // Granular Telemetry Stats
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.sets = 0;
        this.deletes = 0;
        this.totalLookupTimeMs = 0;
        this.lookupCount = 0;
    }

    /**
     * Estimates byte size of value
     */
    _estimateSize(value) {
        if (value === null || value === undefined) return 8;
        if (typeof value === "string") return value.length * 2;
        if (typeof value === "number") return 8;
        if (typeof value === "boolean") return 4;
        if (Array.isArray(value)) {
            if (value.length > 0 && typeof value[0] === "number") {
                return value.length * 8; // Vector array
            }
            return value.length * 32;
        }
        if (typeof value === "object") {
            try {
                return JSON.stringify(value).length * 2;
            } catch {
                return 128;
            }
        }
        return 64;
    }

    /**
     * Retrieves an entry from cache with LRU refresh
     */
    get(key) {
        const start = Date.now();
        this.lookupCount++;

        const entry = this.store.get(key);

        if (!entry) {
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return null;
        }

        // Check TTL expiration
        if (entry.expiry && Date.now() > entry.expiry) {
            this._removeKey(key);
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return null;
        }

        // Refresh LRU position (delete & re-insert to place at end of Map)
        this.store.delete(key);
        entry.lastAccessed = Date.now();
        this.store.set(key, entry);

        this.hits++;
        this.totalLookupTimeMs += (Date.now() - start);
        return entry.value;
    }

    /**
     * Stores an entry with TTL, LRU eviction, and optional categories
     */
    set(key, value, ttlSeconds = null, categories = []) {
        if (value === undefined || value === null) return false;

        const effectiveTtl = ttlSeconds !== null ? Number(ttlSeconds) : this.defaultTtlSeconds;
        const expiry = effectiveTtl > 0 ? Date.now() + (effectiveTtl * 1000) : null;
        const sizeEstimate = this._estimateSize(value);

        // If key already exists, delete it first so insertion order moves to end
        if (this.store.has(key)) {
            this._removeKey(key);
        } else if (this.store.size >= this.maxEntries) {
            // Evict oldest entry (LRU - first key in Map)
            const oldestKey = this.store.keys().next().value;
            if (oldestKey) {
                this._removeKey(oldestKey);
                this.evictions++;
            }
        }

        const cats = Array.isArray(categories) 
            ? categories.map(c => String(c || "").trim().toLowerCase()).filter(Boolean)
            : (categories ? [String(categories).trim().toLowerCase()] : []);

        const entry = {
            value,
            expiry,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            sizeEstimate,
            categories: cats
        };

        this.store.set(key, entry);
        this.sets++;

        // Track categories
        if (this.enableCategoryTracking && cats.length > 0) {
            for (const cat of cats) {
                if (!this.categoryIndex.has(cat)) {
                    this.categoryIndex.set(cat, new Set());
                }
                this.categoryIndex.get(cat).add(key);
            }
        }

        return true;
    }

    /**
     * Check if key exists and is unexpired without full parsing
     */
    has(key) {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (entry.expiry && Date.now() > entry.expiry) {
            this._removeKey(key);
            return false;
        }
        return true;
    }

    /**
     * Deletes a specific key
     */
    delete(key) {
        const existed = this.store.has(key);
        if (existed) {
            this._removeKey(key);
            this.deletes++;
        }
        return existed;
    }

    /**
     * Internal removal of key and its category indexing
     */
    _removeKey(key) {
        const entry = this.store.get(key);
        if (entry && this.enableCategoryTracking && entry.categories) {
            for (const cat of entry.categories) {
                const set = this.categoryIndex.get(cat);
                if (set) {
                    set.delete(key);
                    if (set.size === 0) {
                        this.categoryIndex.delete(cat);
                    }
                }
            }
        }
        return this.store.delete(key);
    }

    /**
     * Invalidates all keys tagged with a specific category
     */
    invalidateCategory(category) {
        if (!category) return 0;
        const cleanCat = String(category).trim().toLowerCase();
        const keys = this.categoryIndex.get(cleanCat);
        if (!keys || keys.size === 0) return 0;

        let count = 0;
        const keysToDelete = Array.from(keys);
        for (const key of keysToDelete) {
            if (this.store.has(key)) {
                this._removeKey(key);
                count++;
            }
        }
        this.categoryIndex.delete(cleanCat);
        return count;
    }

    /**
     * Clears all stored entries and indices
     */
    clear() {
        const size = this.store.size;
        this.store.clear();
        this.categoryIndex.clear();
        return size;
    }

    /**
     * Removes expired entries
     */
    pruneExpired() {
        const now = Date.now();
        let pruned = 0;
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiry && now > entry.expiry) {
                this._removeKey(key);
                pruned++;
            }
        }
        return pruned;
    }

    /**
     * Calculates total estimated memory bytes
     */
    getEstimatedMemoryBytes() {
        let total = 0;
        for (const entry of this.store.values()) {
            total += (entry.sizeEstimate || 64);
        }
        return total;
    }

    /**
     * Formats bytes to human-readable string
     */
    _formatBytes(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || "B"}`;
    }

    /**
     * Returns detailed telemetry & health statistics
     */
    getStats() {
        const totalOps = this.hits + this.misses;
        const hitRatePct = totalOps > 0 ? Number(((this.hits / totalOps) * 100).toFixed(2)) : 0;
        const missRatePct = totalOps > 0 ? Number(((this.misses / totalOps) * 100).toFixed(2)) : 0;
        const avgLookupMs = this.lookupCount > 0 ? Number((this.totalLookupTimeMs / this.lookupCount).toFixed(3)) : 0;
        const memoryBytes = this.getEstimatedMemoryBytes();

        return {
            name: this.name,
            size: this.store.size,
            maxEntries: this.maxEntries,
            defaultTtlSeconds: this.defaultTtlSeconds,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            missRate: `${missRatePct}%`,
            missRatePercent: missRatePct,
            evictions: this.evictions,
            sets: this.sets,
            deletes: this.deletes,
            avgLookupTimeMs: avgLookupMs,
            memoryBytes,
            memoryFormatted: this._formatBytes(memoryBytes),
            categoriesTracked: this.categoryIndex.size,
            status: "healthy"
        };
    }

    /**
     * Exports all active entries (for disk serialization)
     */
    dumpEntries() {
        const entries = [];
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (!entry.expiry || now < entry.expiry) {
                entries.push({
                    key,
                    value: entry.value,
                    expiry: entry.expiry,
                    createdAt: entry.createdAt,
                    categories: entry.categories
                });
            }
        }
        return entries;
    }

    /**
     * Hydrates entries from an exported array
     */
    hydrateEntries(entries = []) {
        if (!Array.isArray(entries)) return 0;
        let loaded = 0;
        const now = Date.now();
        for (const item of entries) {
            if (item && item.key && (!item.expiry || now < item.expiry)) {
                const ttlRemaining = item.expiry ? Math.max(1, Math.round((item.expiry - now) / 1000)) : this.defaultTtlSeconds;
                this.set(item.key, item.value, ttlRemaining, item.categories || []);
                loaded++;
            }
        }
        return loaded;
    }
}

module.exports = BaseLRUCache;
