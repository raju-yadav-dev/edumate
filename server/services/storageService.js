const mongoose = require("mongoose");
const supabase = require("../config/supabase");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET;

/* -----------------------------------------
   Format Bytes
----------------------------------------- */

const formatBytes = (bytes = 0) => {

    if (bytes === 0) return "0 Bytes";

    const sizes = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return (
        (bytes / Math.pow(1024, i)).toFixed(2) +
        " " +
        sizes[i]
    );

};

let cachedMongoStats = null;
let lastMongoStatsTime = 0;
const MONGO_STATS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

let cachedSupabaseStats = null;
let lastSupabaseStatsTime = 0;
const SUPABASE_STATS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

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
            const Chunk = mongoose.model("Chunk");
            
            const docCount = await Document.countDocuments({ status: { $ne: "deleted" } });
            const userCount = await User.countDocuments({ status: { $ne: "deleted" } });
            const chunkCount = await Chunk.countDocuments({});
            
            used = (docCount * 1500) + (userCount * 1000) + (chunkCount * 3000);
        } catch (err) {
            used = 1024 * 1024; // 1 MB default fallback
        }

        cachedMongoStats = {
            connected: true, // Connection is active, stats admin cmd failed
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
   Supabase Stats
   ----------------------------------------- */

const getSupabaseStorage = async (force = false) => {
    const now = Date.now();
    if (!force && cachedSupabaseStats && (now - lastSupabaseStatsTime < SUPABASE_STATS_CACHE_TTL)) {
        return cachedSupabaseStats;
    }

    let total = 0;
    let count = 0;

    const walk = async (folder = "") => {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(folder, {
                limit: 1000
            });

        if (error) throw error;

        if (Array.isArray(data)) {
            for (const item of data) {
                if (!item.id) {
                    await walk(
                        folder
                            ? folder + "/" + item.name
                            : item.name
                    );
                } else {
                    total += item.metadata?.size || 0;
                    count++;
                }
            }
        }
    };

    try {
        await walk();
    } catch (e) {
        console.error("Error walking Supabase storage:", e);
        // Fallback to active documents count/fileSize aggregation
        try {
            const Document = mongoose.model("Document");
            const [result] = await Document.aggregate([
                { $match: { status: { $ne: "deleted" } } },
                {
                    $group: {
                        _id: null,
                        bytes: { $sum: "$fileSize" },
                        count: { $sum: 1 }
                    }
                }
            ]);
            total = result?.bytes || 0;
            count = result?.count || 0;
        } catch (dbErr) {
            console.error("Supabase fallback DB aggregation failed:", dbErr);
        }
    }

    const quotaMB = Number(process.env.SUPABASE_STORAGE_QUOTA_MB) || 1024;
    const quota = quotaMB * 1024 * 1024;

    cachedSupabaseStats = {
        files: count,
        used: total,
        quota,
        remaining: Math.max(quota - total, 0),
        usedFormatted: formatBytes(total),
        quotaFormatted: formatBytes(quota),
        remainingFormatted: formatBytes(Math.max(quota - total, 0)),
        usage: Number(((total / quota) * 100).toFixed(1))
    };
    lastSupabaseStatsTime = now;
    return cachedSupabaseStats;
};

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
   Combined
   ----------------------------------------- */

const getCombinedStorage = async (force = false) => {
    const mongodb = await getMongoStorage(force);
    const supabase = await getSupabaseStorage(force);
    const qdrant = await getQdrantStorage(force);

    const used = mongodb.used + supabase.used + qdrant.used;
    const total = mongodb.storage + supabase.quota + qdrant.total;

    return {
        mongodb,
        supabase,
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

    getSupabaseStorage,

    getQdrantStorage,

    getCombinedStorage

};