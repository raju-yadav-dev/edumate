/**
 * Layer 10 — Persistent Disk Cache
 * EduMate Mission 17 — Production Grade
 * 
 * Responsibilities:
 * - Create and manage local persistent cache under `storage/cache/`
 * - Dedicated subfolders: client, prompt, embeddings, retrieval, responses, chunks, llama, analytics
 * - Transparent GZIP compression for large payloads (>1KB) to minimize disk I/O and footprint
 * - Atomic write operations using temp files (.tmp) to prevent corruption during sudden shutdowns
 * - Deterministic SHA-256 file keys (never raw user prompts in filenames)
 * - Automatic startup hydration and background TTL pruning
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const localStorageManager = require("../../storage/localStorageManager");

class Layer10_PersistentDiskCache {
    constructor() {
        this.cacheRootDir = path.join(localStorageManager.STORAGE_ROOT, "cache");
        this.version = "1.0";
        this.compressionThresholdBytes = 1024; // 1 KB

        this.namespaces = {
            client: path.join(this.cacheRootDir, "client"),
            prompt: path.join(this.cacheRootDir, "prompt"),
            embeddings: path.join(this.cacheRootDir, "embeddings"),
            retrieval: path.join(this.cacheRootDir, "retrieval"),
            responses: path.join(this.cacheRootDir, "responses"),
            chunks: path.join(this.cacheRootDir, "chunks"),
            llama: path.join(this.cacheRootDir, "llama"),
            analytics: path.join(this.cacheRootDir, "analytics")
        };

        this.hits = 0;
        this.misses = 0;
        this.writes = 0;
        this.deletes = 0;
        this.compressions = 0;
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

    /**
     * Computes deterministic SHA-256 key for filenames
     */
    _hashKey(key) {
        if (!key) return "empty_key";
        const normalized = String(key).trim().toLowerCase().normalize("NFC");
        return crypto.createHash("sha256").update(normalized).digest("hex");
    }

    _getFilePath(namespace, key, isGzip = false) {
        const baseDir = this.namespaces[namespace] || this.cacheRootDir;
        const safeKey = this._hashKey(key);
        const ext = isGzip ? ".cache.json.gz" : ".cache.json";
        return path.join(baseDir, `${safeKey}${ext}`);
    }

    /**
     * Reads a cached entry from disk with transparent decompression
     */
    get(namespace, key) {
        const start = Date.now();
        this.lookupCount++;

        const jsonPath = this._getFilePath(namespace, key, false);
        const gzPath = this._getFilePath(namespace, key, true);

        let targetPath = null;
        let isGzip = false;

        if (fs.existsSync(gzPath)) {
            targetPath = gzPath;
            isGzip = true;
        } else if (fs.existsSync(jsonPath)) {
            targetPath = jsonPath;
            isGzip = false;
        } else {
            this.misses++;
            this.totalLookupTimeMs += (Date.now() - start);
            return null;
        }

        try {
            const rawBuffer = fs.readFileSync(targetPath);
            let jsonString;

            if (isGzip) {
                jsonString = zlib.gunzipSync(rawBuffer).toString("utf-8");
            } else {
                jsonString = rawBuffer.toString("utf-8");
            }

            const entry = JSON.parse(jsonString);

            // Check TTL expiration
            if (entry.expiry && Date.now() > entry.expiry) {
                try { fs.unlinkSync(targetPath); } catch (_) {}
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
     * Writes an entry to disk atomically with optional gzip compression
     */
    set(namespace, key, value, ttlSeconds = 86400, categories = []) {
        if (value === undefined || value === null) return false;
        this._ensureDirectories();

        const expiry = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
        const payload = {
            version: this.version,
            key: String(key),
            namespace,
            value,
            expiry,
            createdAt: Date.now(),
            categories: Array.isArray(categories) ? categories : [categories]
        };

        const jsonString = JSON.stringify(payload);
        const buffer = Buffer.from(jsonString, "utf-8");
        const shouldCompress = buffer.length > this.compressionThresholdBytes;

        const targetPath = this._getFilePath(namespace, key, shouldCompress);
        const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;

        // Clean alternate extension if existed
        const alternatePath = this._getFilePath(namespace, key, !shouldCompress);

        try {
            if (shouldCompress) {
                const compressed = zlib.gzipSync(buffer);
                fs.writeFileSync(tempPath, compressed);
                this.compressions++;
            } else {
                fs.writeFileSync(tempPath, buffer);
            }

            fs.renameSync(tempPath, targetPath);

            if (fs.existsSync(alternatePath)) {
                try { fs.unlinkSync(alternatePath); } catch (_) {}
            }

            this.writes++;
            return true;
        } catch (err) {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
            console.warn(`[Layer 10 Disk Cache] Failed writing ${key} to disk:`, err.message);
            return false;
        }
    }

    /**
     * Deletes an entry from disk (both plain and gz formats)
     */
    delete(namespace, key) {
        const jsonPath = this._getFilePath(namespace, key, false);
        const gzPath = this._getFilePath(namespace, key, true);
        let removed = false;

        if (fs.existsSync(jsonPath)) {
            try { fs.unlinkSync(jsonPath); removed = true; } catch (_) {}
        }
        if (fs.existsSync(gzPath)) {
            try { fs.unlinkSync(gzPath); removed = true; } catch (_) {}
        }

        if (removed) {
            this.deletes++;
        }
        return removed;
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
                    if (!file.includes(".cache.json")) continue;
                    const fullPath = path.join(dir, file);
                    try {
                        let jsonString;
                        if (file.endsWith(".gz")) {
                            jsonString = zlib.gunzipSync(fs.readFileSync(fullPath)).toString("utf-8");
                        } else {
                            jsonString = fs.readFileSync(fullPath, "utf-8");
                        }
                        const entry = JSON.parse(jsonString);
                        if (entry.expiry && now > entry.expiry) {
                            fs.unlinkSync(fullPath);
                            pruned++;
                        }
                    } catch (_) {
                        // Corrupted file cleanup
                        try { fs.unlinkSync(fullPath); pruned++; } catch (_) {}
                    }
                }
            } catch (_) {}
        }

        return pruned;
    }

    /**
     * Invalidates all files matching a specific category across all namespaces
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
                    if (!file.includes(".cache.json")) continue;
                    const fullPath = path.join(dir, file);
                    try {
                        let jsonString;
                        if (file.endsWith(".gz")) {
                            jsonString = zlib.gunzipSync(fs.readFileSync(fullPath)).toString("utf-8");
                        } else {
                            jsonString = fs.readFileSync(fullPath, "utf-8");
                        }
                        const entry = JSON.parse(jsonString);
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
     * Purges all cache files on disk across all 8 namespaces
     */
    clear(namespace = null) {
        let count = 0;
        const targetDirs = namespace && this.namespaces[namespace] 
            ? [this.namespaces[namespace]] 
            : Object.values(this.namespaces);

        for (const dir of targetDirs) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (file.includes(".cache.json") || file.endsWith(".tmp")) {
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
                        if (file.includes(".cache.json")) {
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
            namespaceCounts[ns] = { files: nsFiles, bytes: nsBytes, formatted: this._formatBytes(nsBytes) };
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
            compressions: this.compressions,
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
