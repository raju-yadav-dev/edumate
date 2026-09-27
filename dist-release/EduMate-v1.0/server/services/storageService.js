const mongoose = require("mongoose");
const localStorageManager = require("../storage/localStorageManager");

const formatBytes = localStorageManager.formatBytes;

let cachedMongoStats = null;
let lastMongoStatsTime = 0;
const MONGO_STATS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

let cachedLocalStorageStats = null;
let lastLocalStorageStatsTime = 0;
const LOCAL_STORAGE_STATS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const getMongoStorageLimit = () => {
    let limit = Number(process.env.MONGODB_STORAGE_LIMIT_BYTES || process.env.ADMIN_STORAGE_LIMIT_BYTES);
    if (!Number.isFinite(limit) || limit <= 0) {
        const limitMB = Number(process.env.MONGODB_STORAGE_LIMIT_MB || process.env.ADMIN_STORAGE_LIMIT_MB);
        if (Number.isFinite(limitMB) && limitMB > 0) {
            limit = limitMB * 1024 * 1024;
        }
    }
    return limit || 512 * 1024 * 1024; // 512 MB default Atlas limit
};

/* -----------------------------------------
   MongoDB Stats
----------------------------------------- */

const getMongoStorage = async (force = false) => {
    const storage = getMongoStorageLimit();
    const now = Date.now();

    if (!force && cachedMongoStats && (now - lastMongoStatsTime < MONGO_STATS_CACHE_TTL)) {
        return cachedMongoStats;
    }

    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return {
            connected: false,
            used: 0,
            storage,
            remaining: storage,
            usedFormatted: formatBytes(0),
            storageFormatted: formatBytes(storage),
            remainingFormatted: formatBytes(storage),
            usage: 0
        };
    }

    try {
        const stats = await mongoose.connection.db.stats();
        const used = Number(stats.storageSize || stats.dataSize || 0) + Number(stats.indexSize || 0);

        cachedMongoStats = {
            connected: true,
            used,
            storage,
            remaining: Math.max(storage - used, 0),
            usedFormatted: formatBytes(used),
            storageFormatted: formatBytes(storage),
            remainingFormatted: formatBytes(Math.max(storage - used, 0)),
            usage: storage === 0 ? 0 : Number(((used / storage) * 100).toFixed(1))
        };
        lastMongoStatsTime = now;
        return cachedMongoStats;
    } catch (e) {
        console.error("Error fetching MongoDB storage stats, using fallbacks:", e);
        
        let used = 0;
        try {
            const Document = mongoose.model("Document");
            const User = mongoose.model("User");
            
            const docCount = await Document.countDocuments({ status: { $ne: "deleted" } });
            const userCount = await User.countDocuments({ status: { $ne: "deleted" } });
            
            used = (docCount * 1500) + (userCount * 1000);
        } catch (err) {
            used = 1024 * 1024; // 1 MB default fallback
        }

        cachedMongoStats = {
            connected: true,
            used,
            storage,
            remaining: Math.max(storage - used, 0),
            usedFormatted: formatBytes(used),
            storageFormatted: formatBytes(storage),
            remainingFormatted: formatBytes(Math.max(storage - used, 0)),
            usage: storage === 0 ? 0 : Number(((used / storage) * 100).toFixed(1)),
            isFallback: true
        };
        lastMongoStatsTime = now;
        return cachedMongoStats;
    }
};

/* -----------------------------------------
   Local Storage Stats (edumate/storage/)
----------------------------------------- */

const getLocalStorage = async (force = false) => {
    const now = Date.now();
    if (!force && cachedLocalStorageStats && (now - lastLocalStorageStatsTime < LOCAL_STORAGE_STATS_CACHE_TTL)) {
        return cachedLocalStorageStats;
    }

    try {
        const stats = await localStorageManager.getLocalStorageStats(force);
        cachedLocalStorageStats = stats;
        lastLocalStorageStatsTime = now;
        return cachedLocalStorageStats;
    } catch (err) {
        console.error("Error fetching local storage stats:", err);
        return {
            configured: true,
            connected: true,
            files: 0,
            folders: 0,
            used: 0,
            quota: 50 * 1024 * 1024 * 1024,
            remaining: 50 * 1024 * 1024 * 1024,
            usage: 0,
            usedFormatted: formatBytes(0),
            quotaFormatted: formatBytes(50 * 1024 * 1024 * 1024),
            remainingFormatted: formatBytes(50 * 1024 * 1024 * 1024)
        };
    }
};

// Backwards-compatibility alias for any remaining references
const getSupabaseStorage = getLocalStorage;

/* -----------------------------------------
   Qdrant Stats
----------------------------------------- */

const getQdrantStorage = async (force = false) => {
    const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");
    const quotaMB = Number(process.env.QDRANT_STORAGE_LIMIT_MB) || 512;
    const total = quotaMB * 1024 * 1024;

    try {
        const collectionInfo = await qdrantClient.getCollection(qdrantCollection);
        const vectorsCount = collectionInfo.vectors_count || collectionInfo.points_count || 0;
        const dimension = collectionInfo.config?.params?.vectors?.size || 768;
        
        const used = vectorsCount * dimension * 4; // float32 = 4 bytes
        const remaining = Math.max(total - used, 0);
        const usage = total === 0 ? 0 : Number(((used / total) * 100).toFixed(1));

        return {
            connected: true,
            used,
            total,
            remaining,
            usedFormatted: formatBytes(used),
            totalFormatted: formatBytes(total),
            remainingFormatted: formatBytes(remaining),
            usage,
            vectors: vectorsCount,
            status: "green"
        };
    } catch (err) {
        console.error("Error getting Qdrant storage stats in storageService:", err.message);
        return {
            connected: false,
            used: 0,
            total,
            remaining: total,
            usedFormatted: formatBytes(0),
            totalFormatted: formatBytes(total),
            remainingFormatted: formatBytes(total),
            usage: 0,
            vectors: 0,
            status: "red"
        };
    }
};

/* -----------------------------------------
   Combined Storage
----------------------------------------- */

const getCombinedStorage = async (force = false) => {
    const mongodb = await getMongoStorage(force);
    const local = await getLocalStorage(force);
    const qdrant = await getQdrantStorage(force);

    const used = mongodb.used + local.used + qdrant.used;
    const total = mongodb.storage + local.quota + qdrant.total;

    return {
        storageType: "local",
        storagePath: local.rootPath,
        mongodb,
        localStorage: local,
        supabase: local, // Alias for backward compatibility
        qdrant,
        combined: {
            used,
            total,
            remaining: Math.max(total - used, 0),
            usedFormatted: formatBytes(used),
            totalFormatted: formatBytes(total),
            remainingFormatted: formatBytes(Math.max(total - used, 0)),
            usage: Number(((used / total) * 100).toFixed(1))
        }
    };
};

module.exports = {
    getMongoStorage,
    getLocalStorage,
    getSupabaseStorage,
    getQdrantStorage,
    getCombinedStorage,
    getStorageStats: getCombinedStorage
};