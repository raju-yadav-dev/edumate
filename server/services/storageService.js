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

const getMongoStorageLimit = () => {
    let limit = Number(process.env.MONGODB_STORAGE_LIMIT_BYTES || process.env.ADMIN_STORAGE_LIMIT_BYTES);
    if (!Number.isFinite(limit) || limit <= 0) {
        const limitMB = Number(process.env.MONGODB_STORAGE_LIMIT_MB || process.env.ADMIN_STORAGE_LIMIT_MB);
        if (Number.isFinite(limitMB) && limitMB > 0) {
            limit = limitMB * 1024 * 1024;
        }
    }
    return limit || 10 * 1024 * 1024 * 1024;
};

/* -----------------------------------------
   MongoDB Stats
   ----------------------------------------- */

const getMongoStorage = async () => {

    const storage = getMongoStorageLimit();

    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return {
            used: 0,
            storage,
            remaining: storage,
            usedFormatted: formatBytes(0),
            storageFormatted: formatBytes(storage),
            remainingFormatted: formatBytes(storage),
            usage: 0
        };
    }

    const stats = await mongoose.connection.db.stats();

    const used = Number(stats.storageSize || stats.dataSize || 0) + Number(stats.indexSize || 0);

    return {

        used,

        storage,

        remaining: Math.max(storage - used, 0),

        usedFormatted: formatBytes(used),

        storageFormatted: formatBytes(storage),

        remainingFormatted: formatBytes(
            Math.max(storage - used, 0)
        ),

        usage:

            storage === 0

                ? 0

                : Number(

                    ((used / storage) * 100).toFixed(1)

                )

    };

};

/* -----------------------------------------
   Supabase Stats
----------------------------------------- */

const getSupabaseStorage = async () => {

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

                }

                else {

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
    }

    const quotaMB = Number(process.env.SUPABASE_STORAGE_QUOTA_MB) || 1024;
    const quota = quotaMB * 1024 * 1024;

    return {

        files: count,

        used: total,

        quota,

        remaining: Math.max(quota - total, 0),

        usedFormatted: formatBytes(total),

        quotaFormatted: formatBytes(quota),

        remainingFormatted: formatBytes(

            Math.max(quota - total, 0)

        ),

        usage:

            Number(

                ((total / quota) * 100).toFixed(1)

            )

    };

};

/* -----------------------------------------
   Combined
----------------------------------------- */

const getCombinedStorage = async () => {

    const mongodb = await getMongoStorage();

    const supabase = await getSupabaseStorage();

    const used =

        mongodb.used +

        supabase.used;

    const total =

        mongodb.storage +

        supabase.quota;

    return {

        mongodb,

        supabase,

        combined: {

            used,

            total,

            remaining:

                Math.max(total - used, 0),

            usedFormatted:

                formatBytes(used),

            totalFormatted:

                formatBytes(total),

            remainingFormatted:

                formatBytes(

                    Math.max(total - used, 0)

                ),

            usage:

                Number(

                    ((used / total) * 100).toFixed(1)

                )

        }

    };

};

module.exports = {

    getMongoStorage,

    getSupabaseStorage,

    getCombinedStorage

};