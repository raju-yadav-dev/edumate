const asyncHandler = require("../utils/asyncHandler");
const Document = require("../models/Document");
const User = require("../models/User");
const { sendSuccess } = require("../utils/response");
const settingsService = require("../services/settingsService");
const mongoose = require("mongoose");

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

const toStorageLimit = () => {
    const configuredLimit = Number(process.env.ADMIN_STORAGE_LIMIT_BYTES);
    return Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_STORAGE_LIMIT;
};

const getSupabaseConfig = () => {
    const url = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET_NAME;
    const quota = Number(process.env.SUPABASE_STORAGE_LIMIT_BYTES || process.env.SUPABASE_QUOTA_BYTES || DEFAULT_STORAGE_LIMIT);

    return {
        url,
        key,
        bucket,
        quota: Number.isFinite(quota) && quota > 0 ? quota : DEFAULT_STORAGE_LIMIT,
        configured: Boolean(url && key && bucket && typeof fetch === "function")
    };
};

const getMongoStorageStats = async () => {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return {
            connected: false,
            used: 0,
            total: toStorageLimit(),
            remaining: toStorageLimit(),
            usage: 0,
            collections: 0,
            documents: 0,
            indexesSize: 0
        };
    }

    const stats = await mongoose.connection.db.stats();
    const total = Number(process.env.MONGODB_STORAGE_LIMIT_BYTES || toStorageLimit());
    const used = Number(stats.storageSize || stats.dataSize || 0) + Number(stats.indexSize || 0);

    return {
        connected: true,
        total,
        used,
        remaining: Math.max(total - used, 0),
        usage: total ? Math.min((used / total) * 100, 100) : 0,
        collections: stats.collections || 0,
        documents: stats.objects || 0,
        indexesSize: stats.indexSize || 0,
        dataSize: stats.dataSize || 0,
        storageSize: stats.storageSize || 0
    };
};

const listSupabaseObjects = async ({ url, key, bucket, prefix = "", offset = 0 }) => {
    const response = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prefix,
            limit: 1000,
            offset,
            sortBy: {
                column: "name",
                order: "asc"
            }
        })
    });

    if (!response.ok) {
        throw new Error("Unable to list Supabase storage objects.");
    }

    return response.json();
};

const getSupabaseStorageStats = async (fallbackBytes = 0, fallbackCount = 0) => {
    const config = getSupabaseConfig();

    if (!config.configured) {
        return {
            configured: false,
            bucket: config.bucket || "",
            quota: config.quota,
            used: fallbackBytes,
            remaining: Math.max(config.quota - fallbackBytes, 0),
            usage: config.quota ? Math.min((fallbackBytes / config.quota) * 100, 100) : 0,
            files: fallbackCount,
            averageFileSize: fallbackCount ? fallbackBytes / fallbackCount : 0,
            largestFile: null
        };
    }

    let offset = 0;
    let used = 0;
    let files = 0;
    let largestFile = null;

    while (true) {
        const objects = await listSupabaseObjects({
            url: config.url,
            key: config.key,
            bucket: config.bucket,
            offset
        });

        if (!Array.isArray(objects) || objects.length === 0) {
            break;
        }

        objects.forEach((object) => {
            const size = Number(object.metadata?.size || object.size || 0);

            if (size > 0) {
                used += size;
                files += 1;

                if (!largestFile || size > Number(largestFile.size || 0)) {
                    largestFile = {
                        name: object.name,
                        path: object.name,
                        size
                    };
                }
            }
        });

        if (objects.length < 1000) {
            break;
        }

        offset += objects.length;
    }

    return {
        configured: true,
        bucket: config.bucket,
        quota: config.quota,
        used,
        remaining: Math.max(config.quota - used, 0),
        usage: config.quota ? Math.min((used / config.quota) * 100, 100) : 0,
        files,
        averageFileSize: files ? used / files : 0,
        largestFile
    };
};

const sumBsonSizeByFilter = async (Model, filter) => {
    try {
        const [result] = await Model.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    bytes: { $sum: { $bsonSize: "$$ROOT" } },
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            bytes: result?.bytes || 0,
            count: result?.count || 0
        };
    } catch {
        const records = await Model.find(filter).lean();

        return {
            bytes: Buffer.byteLength(JSON.stringify(records)),
            count: records.length
        };
    }
};

const saveApiKeys = asyncHandler(async (req, res) => {
    const settings = await settingsService.saveApiKeys({
        groqApiKeys: req.body.groqApiKeys || [],
        openRouteServiceApiKey: req.body.openRouteServiceApiKey,
        user: req.user
    });

    return sendSuccess(res, 200, "Provider API keys saved successfully.", settings);
});

const getStorageStats = asyncHandler(async (req, res) => {
    const storageLimit = toStorageLimit();
    const activeDocumentFilter = { status: { $ne: "deleted" } };
    const activeUserFilter = { status: { $ne: "deleted" } };
    const adminUserFilter = {
        ...activeUserFilter,
        role: { $in: ["admin", "super_admin"] }
    };
    const regularUserFilter = {
        ...activeUserFilter,
        role: { $nin: ["admin", "super_admin"] }
    };

    const [documentStorage, categoryStorage, documentRecords, userRecords, adminRecords, mongoStats] = await Promise.all([
        Document.aggregate([
            { $match: activeDocumentFilter },
            {
                $group: {
                    _id: null,
                    bytes: { $sum: "$fileSize" },
                    count: { $sum: 1 }
                }
            }
        ]),
        Document.aggregate([
            { $match: activeDocumentFilter },
            {
                $group: {
                    _id: "$category",
                    bytes: { $sum: "$fileSize" },
                    count: { $sum: 1 }
                }
            }
        ]),
        sumBsonSizeByFilter(Document, activeDocumentFilter),
        sumBsonSizeByFilter(User, regularUserFilter),
        sumBsonSizeByFilter(User, adminUserFilter),
        getMongoStorageStats()
    ]);

    const documentBytes = documentStorage[0]?.bytes || 0;
    const documentCount = documentStorage[0]?.count || 0;
    const explorerRecordBytes = documentRecords.bytes || 0;
    const userBytes = userRecords.bytes || 0;
    const adminBytes = adminRecords.bytes || 0;
    const dataBytes = userBytes + adminBytes + explorerRecordBytes;
    const supabaseStats = await getSupabaseStorageStats(documentBytes, documentCount);
    const mongoUsed = mongoStats.used || dataBytes;
    const supabaseUsed = supabaseStats.used || documentBytes;
    const usedBytes = mongoUsed + supabaseUsed;
    const totalBytes = (mongoStats.total || storageLimit) + (supabaseStats.quota || storageLimit);

    return sendSuccess(res, 200, "Storage stats retrieved successfully.", {
        limitBytes: storageLimit,
        totalBytes,
        usedBytes,
        availableBytes: Math.max(totalBytes - usedBytes, 0),
        documentBytes,
        explorerRecordBytes,
        categoryCounts: categoryStorage.reduce((counts, category) => {
            counts[category._id] = {
                count: category.count || 0,
                bytes: category.bytes || 0
            };
            return counts;
        }, {}),
        userBytes,
        adminBytes,
        dataBytes,
        documentCount,
        userCount: userRecords.count || 0,
        adminCount: adminRecords.count || 0,
        mongodbBytes: mongoUsed,
        mongodbStorageSize: mongoStats.total || storageLimit,
        mongodbIndexSize: mongoStats.indexesSize || 0,
        mongodbCollections: mongoStats.collections || 0,
        mongodbObjects: mongoStats.documents || 0,
        supabaseBytes: supabaseUsed,
        supabaseQuotaBytes: supabaseStats.quota || storageLimit,
        supabaseFiles: supabaseStats.files || documentCount,
        supabaseBucket: supabaseStats.bucket,
        supabaseConfigured: supabaseStats.configured,
        supabaseAverageFileSize: supabaseStats.averageFileSize || 0,
        supabaseLargestFile: supabaseStats.largestFile,
        mongodb: {
            total: mongoStats.total || storageLimit,
            used: mongoUsed,
            remaining: Math.max((mongoStats.total || storageLimit) - mongoUsed, 0),
            usage: mongoStats.usage || 0,
            collections: mongoStats.collections || 0,
            documents: mongoStats.documents || 0,
            indexesSize: mongoStats.indexesSize || 0
        },
        supabase: supabaseStats,
        combined: {
            total: totalBytes,
            used: usedBytes,
            remaining: Math.max(totalBytes - usedBytes, 0),
            usage: totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : 0
        },
        knowledgeBase: {
            totalDocuments: documentCount,
            totalPages: 0,
            totalChunks: 0,
            totalEmbeddings: 0,
            processingQueue: 0,
            pendingDocuments: 0,
            successfulDocuments: 0,
            failedDocuments: 0
        },
        systemStatus: {
            mongodb: mongoStats.connected ? "connected" : "unknown",
            supabase: supabaseStats.configured ? "connected" : "not configured",
            groq: "unknown",
            chromadb: "unknown"
        }
    });
});

module.exports = {
    getStorageStats,
    saveApiKeys
};
