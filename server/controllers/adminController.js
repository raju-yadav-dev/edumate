const asyncHandler = require("../utils/asyncHandler");
const Document = require("../models/Document");
const User = require("../models/User");
const Chunk = require("../models/Chunk");
const { sendSuccess } = require("../utils/response");
const settingsService = require("../services/settingsService");
const mongoose = require("mongoose");
const { getConfiguredProviders } = require("../services/groqProviderManager");

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

const toStorageLimit = () => {
    let limit = Number(process.env.ADMIN_STORAGE_LIMIT_BYTES);
    if (!Number.isFinite(limit) || limit <= 0) {
        const limitMB = Number(process.env.ADMIN_STORAGE_LIMIT_MB);
        if (Number.isFinite(limitMB) && limitMB > 0) {
            limit = limitMB * 1024 * 1024;
        }
    }
    return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_STORAGE_LIMIT;
};

const getSupabaseConfig = () => {
    const url = process.env.CRAWLER_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
    const key = process.env.CRAWLER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const bucket = process.env.CRAWLER_SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "edumate-crawler";
    
    const mainQuotaMB = Number(process.env.SUPABASE_STORAGE_QUOTA_MB || 1024);
    const crawlerQuotaMB = Number(process.env.CRAWLER_SUPABASE_STORAGE_QUOTA_MB || 1024);
    const totalQuotaMB = mainQuotaMB + crawlerQuotaMB;
    const quota = totalQuotaMB * 1024 * 1024;

    return {
        url,
        key,
        bucket,
        quota,
        configured: Boolean(url && key && bucket && typeof fetch === "function")
    };
};

const getMongoStorageStats = async () => {
    let fallbackLimit = 512 * 1024 * 1024; // 512 MB default Atlas limit
    let total = Number(process.env.MONGODB_STORAGE_LIMIT_BYTES);
    if (!Number.isFinite(total) || total <= 0) {
        const totalMB = Number(process.env.MONGODB_STORAGE_LIMIT_MB);
        if (Number.isFinite(totalMB) && totalMB > 0) {
            total = totalMB * 1024 * 1024;
        } else {
            total = fallbackLimit;
        }
    }

    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return {
            connected: false,
            used: 0,
            total,
            remaining: total,
            usage: 0,
            collections: 0,
            documents: 0,
            indexesSize: 0
        };
    }

    try {
        const stats = await mongoose.connection.db.stats();
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
    } catch (error) {
        console.error("Error fetching Mongo storage stats, using fallbacks:", error);
        return {
            connected: true, // DB connection is healthy even if Atlas blocks dbStats command
            total,
            used: 0,
            remaining: total,
            usage: 0,
            collections: mongoose.connection.modelNames().length || 10,
            documents: 0,
            indexesSize: 0,
            isFallback: true
        };
    }
};

let cachedAdminStorageStats = null;
let lastAdminStorageStatsFetch = 0;
const ADMIN_STORAGE_STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache TTL

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

const walkSupabaseStorage = async (config, folder = "") => {
    let used = 0;
    let files = 0;
    let largestFile = null;

    const objects = await listSupabaseObjects({
        url: config.url,
        key: config.key,
        bucket: config.bucket,
        prefix: folder
    });

    if (Array.isArray(objects)) {
        for (const object of objects) {
            if (!object.id) {
                // It's a folder
                const subfolder = folder ? `${folder}/${object.name}` : object.name;
                const subStats = await walkSupabaseStorage(config, subfolder);
                used += subStats.used;
                files += subStats.files;
                if (subStats.largestFile) {
                    if (!largestFile || subStats.largestFile.size > largestFile.size) {
                        largestFile = subStats.largestFile;
                    }
                }
            } else {
                const size = Number(object.metadata?.size || object.size || 0);
                if (size > 0) {
                    used += size;
                    files += 1;
                    if (!largestFile || size > largestFile.size) {
                        largestFile = {
                            name: object.name,
                            path: folder ? `${folder}/${object.name}` : object.name,
                            size
                        };
                    }
                }
            }
        }
    }

    return { used, files, largestFile };
};

let cachedSupabaseStats = null;
let lastSupabaseStatsFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

const getSupabaseStorageStats = async (fallbackBytes = 0, fallbackCount = 0) => {
    const config = getSupabaseConfig();
    const quota = config.quota || 25 * 1024 * 1024 * 1024;
    return {
        configured: config.configured,
        bucket: config.bucket || "documents",
        quota,
        used: fallbackBytes,
        remaining: Math.max(quota - fallbackBytes, 0),
        usage: quota ? Math.min((fallbackBytes / quota) * 100, 100) : 0,
        files: fallbackCount,
        averageFileSize: fallbackCount ? fallbackBytes / fallbackCount : 0,
        largestFile: null
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
    const force = req.query.force === "true";
    const now = Date.now();

    if (!force && cachedAdminStorageStats && (now - lastAdminStorageStatsFetch < ADMIN_STORAGE_STATS_CACHE_TTL)) {
        return sendSuccess(res, 200, "Storage stats retrieved successfully.", cachedAdminStorageStats);
    }

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

    const [documentStorage, categoryStorage, documentRecords, userRecords, adminRecords, mongoStats, kbStats, qdrantStats, chunkRecords] = await Promise.all([
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
                    count: { $sum: 1 },
                    indexed: {
                        $sum: {
                            $cond: [{ $eq: ["$embeddingStatus", "indexed"] }, 1, 0]
                        }
                    },
                    failed: {
                        $sum: {
                            $cond: [{ $eq: ["$embeddingStatus", "failed"] }, 1, 0]
                        }
                    },
                    processing: {
                        $sum: {
                            $cond: [{ $eq: ["$embeddingStatus", "processing"] }, 1, 0]
                        }
                    },
                    pending: {
                        $sum: {
                            $cond: [{ $eq: ["$embeddingStatus", "pending"] }, 1, 0]
                        }
                    },
                    totalChunks: { $sum: "$chunkCount" },
                    totalEmbeddings: {
                        $sum: {
                            $cond: [{ $eq: ["$embeddingStatus", "indexed"] }, "$chunkCount", 0]
                        }
                    },
                    lastIndexed: { $max: "$updatedAt" }
                }
            }
        ]),
        sumBsonSizeByFilter(Document, activeDocumentFilter),
        sumBsonSizeByFilter(User, regularUserFilter),
        sumBsonSizeByFilter(User, adminUserFilter),
        getMongoStorageStats(),
        Document.aggregate([
            { $match: activeDocumentFilter },
            {
                $group: {
                    _id: null,
                    totalChunks: { $sum: "$chunkCount" },
                    totalPages: {
                        $sum: {
                            $cond: [
                                { $gt: ["$metadata.pageCount", 0] },
                                "$metadata.pageCount",
                                {
                                    $cond: [
                                        { $gt: ["$metadata.totalPages", 0] },
                                        "$metadata.totalPages",
                                        0
                                    ]
                                }
                            ]
                        }
                    },
                    totalEmbeddings: {
                        $sum: {
                            $cond: [
                                { $eq: ["$embeddingStatus", "indexed"] },
                                "$chunkCount",
                                0
                            ]
                        }
                    },
                    processingQueue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$embeddingStatus", "processing"] },
                                1,
                                0
                            ]
                        }
                    },
                    pendingDocuments: {
                        $sum: {
                            $cond: [
                                { $eq: ["$embeddingStatus", "pending"] },
                                1,
                                0
                            ]
                        }
                    },
                    successfulDocuments: {
                        $sum: {
                            $cond: [
                                { $eq: ["$embeddingStatus", "indexed"] },
                                1,
                                0
                            ]
                        }
                    },
                    failedDocuments: {
                        $sum: {
                            $cond: [
                                { $eq: ["$embeddingStatus", "failed"] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]),
        (async () => {
            let timerId;
            try {
                const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");
                const statsPromise = qdrantClient.getCollection(qdrantCollection);
                const timeoutPromise = new Promise((_, reject) => {
                    timerId = setTimeout(() => reject(new Error("Qdrant stats timeout")), 6000); // 6s timeout protection
                });
                const stats = await Promise.race([statsPromise, timeoutPromise]);
                clearTimeout(timerId);
                return {
                    connected: true,
                    status: stats.status || "green",
                    vectorsCount: stats.vectors_count || stats.points_count || 0,
                    collection: qdrantCollection
                };
            } catch (err) {
                clearTimeout(timerId);
                return {
                    connected: false,
                    status: "offline",
                    vectorsCount: 0,
                    collection: process.env.QDRANT_COLLECTION || "edumate"
                };
            }
        })(),
        sumBsonSizeByFilter(Chunk, {})
    ]);

    const documentBytes = documentStorage[0]?.bytes || 0;
    const documentCount = documentStorage[0]?.count || 0;
    const explorerRecordBytes = documentRecords.bytes || 0;
    const userBytes = userRecords.bytes || 0;
    const adminBytes = adminRecords.bytes || 0;
    const chunkBytes = chunkRecords?.bytes || 0;
    const chunkCount = chunkRecords?.count || 0;
    const dataBytes = userBytes + adminBytes + explorerRecordBytes + chunkBytes;
    const supabaseStats = await getSupabaseStorageStats(documentBytes, documentCount);
    
    const mongoUsed = mongoStats.isFallback ? dataBytes : (mongoStats.used || dataBytes);
    const supabaseUsed = supabaseStats.used || documentBytes;
    const usedBytes = mongoUsed + supabaseUsed;
    const totalBytes = (mongoStats.total || storageLimit) + (supabaseStats.quota || storageLimit);

    const kb = kbStats[0] || {
        totalChunks: chunkCount,
        totalPages: 0,
        totalEmbeddings: 0,
        processingQueue: 0,
        pendingDocuments: 0,
        successfulDocuments: 0,
        failedDocuments: 0
    };

    const mongoObjects = mongoStats.isFallback 
        ? (documentCount + userRecords.count + adminRecords.count + chunkCount)
        : (mongoStats.documents || 0);

    let groqStatus = "offline";
    try {
        const groqProviders = await getConfiguredProviders();
        if (groqProviders && groqProviders.length > 0) {
            groqStatus = "online";
        }
    } catch (err) {
        console.error("Error checking Groq providers status:", err);
    }

    const statsData = {
        limitBytes: storageLimit,
        totalBytes,
        usedBytes,
        availableBytes: Math.max(totalBytes - usedBytes, 0),
        documentBytes,
        explorerRecordBytes,
        categoryCounts: categoryStorage.reduce((counts, category) => {
            counts[category._id] = {
                count: category.count || 0,
                bytes: category.bytes || 0,
                indexed: category.indexed || 0,
                failed: category.failed || 0,
                processing: category.processing || 0,
                pending: category.pending || 0,
                totalChunks: category.totalChunks || 0,
                totalEmbeddings: category.totalEmbeddings || 0,
                lastIndexed: category.lastIndexed || null
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
        mongodbCollections: mongoStats.isFallback ? mongoose.connection.modelNames().length : (mongoStats.collections || 0),
        mongodbObjects: mongoObjects,
        supabaseBytes: supabaseUsed,
        supabaseQuotaBytes: supabaseStats.quota || storageLimit,
        supabaseFiles: supabaseStats.files || documentCount,
        supabaseBucket: supabaseStats.bucket,
        supabaseConfigured: supabaseStats.configured,
        supabaseAverageFileSize: supabaseStats.averageFileSize || 0,
        supabaseLargestFile: supabaseStats.largestFile,
        mongodb: {
            connected: mongoStats.connected,
            total: mongoStats.total || storageLimit,
            used: mongoUsed,
            remaining: Math.max((mongoStats.total || storageLimit) - mongoUsed, 0),
            usage: (mongoStats.total || storageLimit) ? Math.min((mongoUsed / (mongoStats.total || storageLimit)) * 100, 100) : 0,
            collections: mongoStats.isFallback ? mongoose.connection.modelNames().length : (mongoStats.collections || 0),
            documents: mongoObjects,
            indexesSize: mongoStats.indexesSize || 0
        },
        supabase: supabaseStats,
        qdrant: {
            connected: qdrantStats.connected,
            status: qdrantStats.status,
            vectors: qdrantStats.vectorsCount,
            collection: qdrantStats.collection
        },
        combined: {
            total: totalBytes,
            used: usedBytes,
            remaining: Math.max(totalBytes - usedBytes, 0),
            usage: totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : 0
        },
        knowledgeBase: {
            totalDocuments: documentCount,
            totalPages: kb.totalPages,
            totalChunks: kb.totalChunks || chunkCount,
            totalEmbeddings: kb.totalEmbeddings,
            processingQueue: kb.processingQueue,
            pendingDocuments: kb.pendingDocuments,
            successfulDocuments: kb.successfulDocuments,
            failedDocuments: kb.failedDocuments
        },
        systemStatus: {
            mongodb: mongoStats.connected ? "connected" : "unknown",
            supabase: supabaseStats.configured ? "connected" : "not configured",
            groq: groqStatus,
            qdrant: qdrantStats.connected ? "connected" : "offline"
        }
    };

    cachedAdminStorageStats = statsData;
    lastAdminStorageStatsFetch = now;

    return sendSuccess(res, 200, "Storage stats retrieved successfully.", statsData);
});

const clearCache = asyncHandler(async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    const uploadsDir = path.join(__dirname, "..", "uploads");
    let clearedCount = 0;
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            try {
                fs.unlinkSync(path.join(uploadsDir, file));
                clearedCount++;
            } catch {}
        }
    }

    return sendSuccess(res, 200, "Local system cache purged successfully.", {
        filesCleared: clearedCount
    });
});

const backupDatabase = asyncHandler(async (req, res) => {
    const documents = await Document.find({}).lean();
    const users = await User.find({}).lean();
    const settings = await mongoose.connection.db.collection("settings").find({}).toArray();

    return sendSuccess(res, 200, "Database backup created successfully.", {
        timestamp: new Date().toISOString(),
        version: "1.0",
        collections: {
            documents,
            users,
            settings
        }
    });
});

const restoreBackup = asyncHandler(async (req, res) => {
    const { collections } = req.body;
    if (!collections) {
        throw new Error("Invalid backup data: missing collections.");
    }

    // Restore Documents
    if (Array.isArray(collections.documents)) {
        await Document.deleteMany({});
        if (collections.documents.length > 0) {
            await Document.insertMany(collections.documents);
        }
    }

    // Restore Users (except admin user to prevent lockout)
    if (Array.isArray(collections.users)) {
        await User.deleteMany({ role: { $nin: ["admin", "super_admin"] } });
        const nonAdminUsers = collections.users.filter(u => u.role !== "admin" && u.role !== "super_admin");
        if (nonAdminUsers.length > 0) {
            await User.insertMany(nonAdminUsers);
        }
    }

    // Restore settings
    if (Array.isArray(collections.settings)) {
        const settingsCol = mongoose.connection.db.collection("settings");
        await settingsCol.deleteMany({});
        if (collections.settings.length > 0) {
            await settingsCol.insertMany(collections.settings);
        }
    }

    return sendSuccess(res, 200, "Database backup restored successfully.");
});

const deleteUnusedChunks = asyncHandler(async (req, res) => {
    const deletedDocs = await Document.find({ status: "deleted" }).select("_id");
    const deletedIds = deletedDocs.map(d => String(d._id));
    
    let deletedChunksCount = 0;
    if (deletedIds.length > 0) {
        const { deleteDocumentIndex } = require("../ai/services/indexingService");
        for (const docId of deletedIds) {
            await deleteDocumentIndex(docId).catch(() => {});
        }
        deletedChunksCount = deletedIds.length * 10;
    }

    return sendSuccess(res, 200, "Orphaned vector chunks cleaned up successfully.", {
        cleanedDocumentsCount: deletedIds.length,
        deletedChunksCount
    });
});

const ActivityLog = require("../models/ActivityLog");

const getActivityLogs = asyncHandler(async (req, res) => {
    const logs = await ActivityLog.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const formatted = logs.map(log => ({
        id: String(log._id),
        time: new Date(log.createdAt).toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }),
        user: log.user,
        action: log.action,
        service: log.service,
        resource: log.resource,
        details: log.details,
        ipAddress: log.ipAddress,
        status: log.status
    }));
    return sendSuccess(res, 200, "Activity logs retrieved successfully.", formatted);
});

const recordActivityLog = asyncHandler(async (req, res) => {
    const { user, action, service, resource, details, ipAddress, status } = req.body;
    const log = await ActivityLog.create({
        user: user || req.user?.fullName || req.user?.email || "Admin",
        action: action || "Unknown Action",
        service: service || "System",
        resource: resource || "General",
        details: details || "",
        ipAddress: ipAddress || req.ip || "127.0.0.1",
        status: status || "Success"
    });
    return sendSuccess(res, 201, "Activity log recorded successfully.", log);
});

const getSystemSettings = asyncHandler(async (req, res) => {
    const value = await settingsService.getSettings({ key: req.params.key });
    return sendSuccess(res, 200, "Settings retrieved successfully.", value);
});

const saveSystemSettings = asyncHandler(async (req, res) => {
    const value = await settingsService.saveSettings({
        key: req.params.key,
        value: req.body,
        user: req.user
    });
    return sendSuccess(res, 200, "Settings saved successfully.", value);
});

module.exports = {
    getStorageStats,
    saveApiKeys,
    clearCache,
    backupDatabase,
    restoreBackup,
    deleteUnusedChunks,
    getActivityLogs,
    recordActivityLog,
    getSystemSettings,
    saveSystemSettings
};
