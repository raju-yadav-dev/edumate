const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        tokenHash: {
            type: String,
            required: true,
            index: true
        },
        sessionId: {
            type: String,
            required: true,
            index: true
        },
        deviceName: {
            type: String,
            default: "Unknown Device"
        },
        browser: {
            type: String,
            default: "Unknown Browser"
        },
        os: {
            type: String,
            default: "Unknown OS"
        },
        ipAddress: {
            type: String,
            default: ""
        },
        isRevoked: {
            type: Boolean,
            default: false,
            index: true
        },
        lastUsedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 } // MongoDB TTL index to auto-delete expired documents
        }
    },
    {
        timestamps: true
    }
);

refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ tokenHash: 1, isRevoked: 1 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
