const mongoose = require("mongoose");

const routeCacheSchema = new mongoose.Schema({
    startKey: {
        type: String,
        required: true,
        index: true
    },
    endKey: {
        type: String,
        required: true,
        index: true
    },
    options: {
        type: Array,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // TTL of 24 hours (in seconds)
    }
});

// Compound index for fast lookup
routeCacheSchema.index({ startKey: 1, endKey: 1 }, { unique: true });

module.exports = mongoose.model("RouteCache", routeCacheSchema);
