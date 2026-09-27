const mongoose = require("mongoose");

const documentVersionSchema = new mongoose.Schema(
    {
        version: {
            type: Number,
            required: true
        },
        storedName: {
            type: String,
            required: true
        },
        storagePath: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        checksum: {
            type: String,
            required: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

const chunkStatsSchema = new mongoose.Schema(
    {
        totalChunks: { type: Number, default: 0 },
        embeddedChunks: { type: Number, default: 0 },
        indexedChunks: { type: Number, default: 0 },
        failedChunks: { type: Number, default: 0 },
        processingTime: { type: Number, default: 0 },
        tokenCount: { type: Number, default: 0 },
        pageCount: { type: Number, default: 0 }
    },
    { _id: false }
);

const failureInfoSchema = new mongoose.Schema(
    {
        failedStage: { type: String, default: "" },
        errorCode: { type: String, default: "" },
        errorMessage: { type: String, default: "" },
        timestamp: { type: Date, default: null }
    },
    { _id: false }
);

const documentSchema = new mongoose.Schema(
    {
        originalName: {
            type: String,
            required: true,
            trim: true
        },
        storedName: {
            type: String,
            required: true
        },
        category: {
            type: String,
            required: true,
            index: true,
            trim: true
        },
        institution: {
            type: String,
            default: "",
            index: true,
            trim: true
        },
        department: {
            type: String,
            default: "",
            index: true,
            trim: true
        },
        mimeType: {
            type: String,
            required: true
        },
        fileSize: {
            type: Number,
            required: true
        },
        checksum: {
            type: String,
            required: true,
            index: true
        },
        contentHash: {
            type: String,
            default: "",
            index: true
        },
        storagePath: {
            type: String,
            required: true
        },
        embeddingStatus: {
            type: String,
            enum: [
                "pending",
                "queued",
                "processing",
                "chunked",
                "embedding",
                "indexing",
                "completed",
                "indexed",
                "failed",
                "cancelled",
                "paused",
                "not_required"
            ],
            default: "pending",
            index: true
        },
        progress: {
            type: Number,
            default: 0
        },
        currentStage: {
            type: String,
            default: ""
        },
        queuePosition: {
            type: Number,
            default: 0
        },
        queueStartTime: {
            type: Date,
            default: null
        },
        queueEndTime: {
            type: Date,
            default: null
        },
        workerId: {
            type: String,
            default: ""
        },
        retryCount: {
            type: Number,
            default: 0
        },
        processingDuration: {
            type: Number,
            default: 0
        },
        chunkCount: {
            type: Number,
            default: 0
        },
        chunksCount: {
            type: Number,
            default: 0
        },
        chunkStats: {
            type: chunkStatsSchema,
            default: () => ({})
        },
        failureInfo: {
            type: failureInfoSchema,
            default: () => ({})
        },
        healthy: {
            type: Boolean,
            default: true,
            index: true
        },
        validationReport: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        status: {
            type: String,
            enum: ["active", "archived", "deleted"],
            default: "active",
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        versions: {
            type: [documentVersionSchema],
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

documentSchema.index({ institution: 1, category: 1, status: 1, updatedAt: -1 });
documentSchema.index({ originalName: "text", category: "text", department: "text" });

module.exports = mongoose.model("Document", documentSchema);
