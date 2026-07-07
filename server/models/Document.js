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
        storagePath: {
            type: String,
            required: true
        },
        embeddingStatus: {
            type: String,
            enum: ["pending", "processing", "indexed", "failed", "not_required"],
            default: "pending",
            index: true
        },
        chunkCount: {
            type: Number,
            default: 0
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
