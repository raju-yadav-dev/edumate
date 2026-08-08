const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
    {
        user: {
            type: String,
            required: true
        },
        action: {
            type: String,
            required: true
        },
        service: {
            type: String,
            required: true
        },
        resource: {
            type: String,
            required: true
        },
        details: {
            type: String,
            default: ""
        },
        ipAddress: {
            type: String,
            default: "127.0.0.1"
        },
        status: {
            type: String,
            enum: ["Success", "Failed"],
            default: "Success"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
