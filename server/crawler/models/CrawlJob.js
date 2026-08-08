const mongoose = require("mongoose");

const crawlJobSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true
        },
        maxPages: {
            type: mongoose.Schema.Types.Mixed,
            default: 50
        },
        category: {
            type: String,
            default: "others",
            trim: true
        },
        status: {
            type: String,
            enum: ["queued", "crawling", "completed", "completed_with_errors", "failed", "cancelled"],
            default: "queued",
            index: true
        },
        pagesCrawled: {
            type: Number,
            default: 0
        },
        crawledUrls: {
            type: [String],
            default: []
        },
        errors: {
            type: [String],
            default: []
        },
        progress: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        institution: {
            type: String,
            default: "",
            index: true,
            trim: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true,
        suppressReservedKeysWarning: true
    }
);

module.exports = mongoose.model("CrawlJob", crawlJobSchema);
