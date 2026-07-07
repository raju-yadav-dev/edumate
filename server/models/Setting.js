const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        visibility: {
            type: String,
            enum: ["private", "public"],
            default: "private"
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

module.exports = mongoose.model("Setting", settingSchema);
