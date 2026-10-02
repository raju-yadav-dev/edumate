const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        email: {
            type: String,
            default: "",
            index: true
        },
        role: {
            type: String,
            default: "unknown",
            index: true
        },
        action: {
            type: String,
            required: true,
            index: true
        },
        resourceType: {
            type: String,
            default: ""
        },
        resourceId: {
            type: String,
            default: ""
        },
        ipAddress: {
            type: String,
            default: ""
        },
        userAgent: {
            type: String,
            default: ""
        },
        success: {
            type: Boolean,
            default: true,
            index: true
        },
        errorCode: {
            type: String,
            default: ""
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    {
        timestamps: true
    }
);

auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
