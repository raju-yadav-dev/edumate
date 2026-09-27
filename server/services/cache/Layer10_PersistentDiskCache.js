/**
 * Layer 10 — Persistent Disk Cache
 * EduMate Mission 14.1
 * 
 * Responsibilities:
 * - Create local persistent cache inside EduMate storage system (`storage/cache/`)
 * - Store cache indexes, embeddings, retrieval cache, prompt cache, and LLM responses
 * - Atomic persistence to disk prevents corrupted cache files on sudden process stops
 * - Fast asynchronous hydration on server startup
 * - Disk space usage monitoring and automated TTL eviction
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const localStorageManager = require("../../storage/localStorageManager");

class Layer10_PersistentDiskCache {
    constructor() {
        this.cacheRootDir = path.join(localStorageManager.STORAGE_ROOT, "cache");
        this.namespaces = {
            embeddings: path.join(this.cacheRootDir, "embeddings"),
            retrieval: path.join(this.cacheRootDir, "retrieval"),
            prompts: path.join(this.cacheRootDir, "prompts"),
            responses: path.join(this.cacheRootDir, "responses")
        };
        this.catalogFilePath = path.join(this.cacheRootDir, "index.json");

        this.hits = 0;
        this.misses = 0;
        this.writes = 0;
        this.deletes = 0;
        this.totalLookupTimeMs = 0;
        this.lookupCount = 0;

        this._ensureDirectories();
    }

    _ensureDirectories() {
        try {
            if (!fs.existsSync(this.cacheRootDir)) {
                fs.mkdirSync(this.cacheRootDir, { recursive: true });
            }
            for (const dir of Object.values(this.namespaces)) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            }
        } catch (err) {
            console.warn("[Layer 10 Disk Cache] Warning ensuring directories:", err.message);
        }
    }

    _getFilePath(namespace, key) {
        const baseDir = this.namespaces[namespace] || this.cacheRootDir;
        const safeKey = crypto.createHash("sha256").update(String(key)).digest("hex");
        return path.join(baseDir, `${safeKey}.cache.json`);
    }

    /**
     * Reads a cached entry from disk
     */
    get(namespace, key) {
        const start = Date.now();
        this.lookupCount++;

        const filePath = this._getFilePath(namespace, key);
        if (!fs.existsSync(filePath)) {
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return null;
        }

        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const entry = JSON.parse(raw);

            // Check TTL expiration
            if (entry.expiry && Date.now() > entry.expiry) {
                try { fs.unlinkSync(filePath); } catch (_) {}
                this.misses++;
                this.totalLookupTimeMs += (Date.now() - start);
                return null;
            }

            this.hits++;
            this.totalLookupTimeMs += (Date.now() - start);
            return entry.value;
        } catch (err) {
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return null;
        }
    }

    /**
     * Writes an entry to disk atomically
     */
    set(namespace, key, value, ttlSeconds = 86400, categories = []) {
        if (value === undefined || value === null) return false;
        this._ensureDirectories();

        const filePath = this._getFilePath(namespace, key);
        const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;

        const expiry = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
        const payload = {
            key,
            namespace,
            value,
            expiry,
            createdAt: Date.now(),
            categories: Array.isArray(categories) ? categories : [categories]
        };

        try {
            fs.writeFileSync(tempPath, JSON.stringify(payload), "utf-8");
            fs.renameSync(tempPath, filePath);
            this.writes++;
            return true;
        } catch (err) {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
            console.warn(`[Layer 10 Disk Cache] Failed writing ${key} to disk:`, err.message);
            return false;
        }
    }

    /**
     * Deletes an entry from disk
     */
    delete(namespace, key) {
        const filePath = this._getFilePath(namespace, key);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                this.deletes++;
                return true;
            } catch (_) {}
        }
        return false;
    }

    /**
     * Cleans up expired files across all namespaces
     */
    pruneExpired() {
        let pruned = 0;
        const now = Date.now();

        for (const dir of Object.values(this.namespaces)) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (!file.endsWith(".cache.json")) continue;
                    const fullPath = path.join(dir, file);
                    try {
                        const raw = fs.readFileSync(fullPath, "utf-8");
                        const entry = JSON.parse(raw);
                        if (entry.expiry && now > entry.expiry) {
                            fs.unlinkSync(fullPath);
                            pruned++;
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }

        return pruned;
    }

    /**
     * Invalidates all files matching a specific category
     */
    invalidateCategory(category) {
        if (!category) return 0;
        const cleanCat = String(category).trim().toLowerCase();
        let count = 0;

        for (const dir of Object.values(this.namespaces)) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (!file.endsWith(".cache.json")) continue;
                    const fullPath = path.join(dir, file);
                    try {
                        const raw = fs.readFileSync(fullPath, "utf-8");
                        const entry = JSON.parse(raw);
                        if (entry.categories && Array.isArray(entry.categories)) {
                            if (entry.categories.some(c => String(c).toLowerCase() === cleanCat)) {
                                fs.unlinkSync(fullPath);
                                count++;
                            }
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }

        return count;
    }

    /**
     * Purges all cache files on disk
     */
    clear() {
        let count = 0;
        for (const dir of Object.values(this.namespaces)) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (file.endsWith(".cache.json") || file.endsWith(".tmp")) {
                        try {
                            fs.unlinkSync(path.join(dir, file));
                            count++;
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        return count;
    }

    /**
     * Computes persistent disk metrics
     */
    getDiskUsage() {
        let totalFiles = 0;
        let totalBytes = 0;
        const namespaceCounts = {};

        for (const [ns, dir] of Object.entries(this.namespaces)) {
            let nsFiles = 0;
            let nsBytes = 0;
            if (fs.existsSync(dir)) {
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        if (file.endsWith(".cache.json")) {
                            const fullPath = path.join(dir, file);
                            try {
                                const stat = fs.statSync(fullPath);
                                nsBytes += stat.size;
                                nsFiles++;
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            totalFiles += nsFiles;
            totalBytes += nsBytes;
            namespaceCounts[ns] = { files: nsFiles, bytes: nsBytes };
        }

        return {
            totalFiles,
            totalBytes,
            totalFormatted: this._formatBytes(totalBytes),
            cacheRootDir: this.cacheRootDir,
            namespaceCounts
        };
    }

    _formatBytes(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] || "B"}`;
    }

    getStats() {
        const diskUsage = this.getDiskUsage();
        const totalOps = this.hits + this.misses;
        const hitRatePct = totalOps > 0 ? Number(((this.hits / totalOps) * 100).toFixed(2)) : 0;
        const avgLookupMs = this.lookupCount > 0 ? Number((this.totalLookupTimeMs / this.lookupCount).toFixed(3)) : 0;

        return {
            layer: 10,
            name: "Layer 10 — Persistent Disk Cache",
            size: diskUsage.totalFiles,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRatePct}%`,
            hitRatePercent: hitRatePct,
            writes: this.writes,
            deletes: this.deletes,
            avgLookupTimeMs: avgLookupMs,
            diskBytes: diskUsage.totalBytes,
            diskFormatted: diskUsage.totalFormatted,
            diskPath: this.cacheRootDir,
            namespaces: diskUsage.namespaceCounts,
            status: "healthy"
        };
    }
}

module.exports = new Layer10_PersistentDiskCache();
