const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["document", "official_web", "trusted_web", "map", "system"],
            required: true
        },
        title: {
            type: String,
            required: true
        },
        reference: {
            type: String,
            default: ""
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        _id: false
    }
);

const messageSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ["user", "assistant", "system"],
            required: true
        },
        content: {
            type: String,
            required: true,
            trim: true
        },
        intent: {
            type: String,
            default: "unknown",
            index: true
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0
        },
        sources: {
            type: [sourceSchema],
            default: []
        },
        provider: {
            type: String,
            default: "system"
        },
        responseTimeMs: {
            type: Number,
            default: 0
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

const chatSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            default: "New chat",
            trim: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        institution: {
            type: String,
            default: "",
            index: true
        },
        status: {
            type: String,
            enum: ["active", "archived", "deleted"],
            default: "active",
            index: true
        },
        pinned: {
            type: Boolean,
            default: false
        },
        messages: {
            type: [messageSchema],
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
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

chatSchema.index({ user: 1, updatedAt: -1 });
chatSchema.index({ user: 1, status: 1, pinned: -1, updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
