const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema(
    {
        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            required: true,
            index: true
        },
        content: {
            type: String,
            required: true
        },
        embedding: {
            type: [Number],
            required: true
        },
        metadata: {
            pageNumber: {
                type: Number,
                default: 1
            },
            originalName: {
                type: String,
                default: ""
            },
            category: {
                type: String,
                default: ""
            },
            institution: {
                type: String,
                default: "",
                index: true
            },
            department: {
                type: String,
                default: "",
                index: true
            },
            sourceType: {
                type: String
            },
            buildingNumber: {
                type: String
            },
            buildingName: {
                type: String
            },
            floor: {
                type: String
            },
            roomNumber: {
                type: String
            },
            documentType: {
                type: String
            },
            documentName: {
                type: String
            },
            page: {
                type: Number
            },
            source: {
                type: String
            },
            academicEntities: {
                type: Array
            }
        }
    },
    {
        timestamps: true
    }
);

// Indexes to speed up metadata-filtered search queries
chunkSchema.index({ "metadata.institution": 1, "metadata.category": 1 });
chunkSchema.index({ "metadata.institution": 1, "metadata.department": 1 });

module.exports = mongoose.model("Chunk", chunkSchema);
