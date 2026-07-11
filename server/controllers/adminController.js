const asyncHandler = require("../utils/asyncHandler");
const Document = require("../models/Document");
const User = require("../models/User");
const { sendSuccess } = require("../utils/response");
const settingsService = require("../services/settingsService");

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

const toStorageLimit = () => {
    const configuredLimit = Number(process.env.ADMIN_STORAGE_LIMIT_BYTES);
    return Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_STORAGE_LIMIT;
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

    const [documentStorage, categoryStorage, documentRecords, userRecords, adminRecords] = await Promise.all([
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
        sumBsonSizeByFilter(User, adminUserFilter)
    ]);

    const documentBytes = documentStorage[0]?.bytes || 0;
    const documentCount = documentStorage[0]?.count || 0;
    const explorerRecordBytes = documentRecords.bytes || 0;
    const userBytes = userRecords.bytes || 0;
    const adminBytes = adminRecords.bytes || 0;
    const dataBytes = userBytes + adminBytes + explorerRecordBytes;
    const usedBytes = documentBytes + dataBytes;

    return sendSuccess(res, 200, "Storage stats retrieved successfully.", {
        limitBytes: storageLimit,
        usedBytes,
        availableBytes: Math.max(storageLimit - usedBytes, 0),
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
        adminCount: adminRecords.count || 0
    });
});

module.exports = {
    getStorageStats,
    saveApiKeys
};
