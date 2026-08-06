const mongoose = require("mongoose");

const knowledgeSourceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["pdf", "url", "internet"],
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        url: {
            type: String,
            trim: true,
            default: ""
        },
        priority: {
            type: Number,
            required: true,
            default: 1
        },
        isEnabled: {
            type: Boolean,
            default: true
        },
        crawlStatus: {
            type: String,
            enum: ["pending", "crawling", "completed", "failed", "not_applicable"],
            default: "not_applicable"
        },
        syncInterval: {
            type: String,
            enum: ["manual", "daily", "weekly", "monthly", "disabled"],
            default: "manual"
        },
        lastSyncAt: {
            type: Date
        },
        stats: {
            pages: { type: Number, default: 0 },
            documents: { type: Number, default: 0 },
            chunks: { type: Number, default: 0 },
            embeddings: { type: Number, default: 0 },
            storageUsed: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
            downloaded: { type: Number, default: 0 },
            errors: [{ type: String }]
        }
    },
    {
        timestamps: true,
        suppressReservedKeysWarning: true
    }
);

// Indexing by priority for rapid sequencing
knowledgeSourceSchema.index({ priority: 1, isEnabled: 1 });

module.exports = mongoose.model("KnowledgeSource", knowledgeSourceSchema);
