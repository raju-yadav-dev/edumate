const crypto = require("crypto");
const path = require("path");

const Document = require("../models/Document");
const supabase = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");
const taskRegistry = require("../utils/taskRegistry");
const { sendSuccess } = require("../utils/response");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

const uploadDocument = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No file uploaded."
        });
    }

    const {
        category,
        institution = "",
        department = ""
    } = req.body;

    if (!category) {
        return res.status(400).json({
            success: false,
            message: "Category is required."
        });
    }

    const task = taskRegistry.createTask(`Upload document: ${req.file.originalname} (via upload route)`, "upload_document");

    taskRegistry.addTask(task.id, async () => {
        const file = req.file;

        let extension = path.extname(file.originalname);
        const isImage = file.mimetype && file.mimetype.startsWith("image/");
        if (isImage) {
            extension = ".png";
        }

        const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
        const storagePath = `${category}/${uniqueName}`;

        const uploadMimeType = isImage ? "image/png" : file.mimetype;

        //------------------------------------------
        // Upload to Supabase
        //------------------------------------------
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file.buffer, {
                contentType: uploadMimeType,
                upsert: false
            });

        if (error) {
            throw error;
        }

        //------------------------------------------
        // Save metadata
        //------------------------------------------
        const checksum = crypto
            .createHash("sha256")
            .update(file.buffer)
            .digest("hex");

        const document = await Document.create({
            originalName: file.originalname,
            storedName: uniqueName,
            category,
            institution,
            department,
            mimeType: file.mimetype,
            fileSize: file.size,
            checksum,
            storagePath,
            createdBy: req.user._id,
            updatedBy: req.user._id,
            metadata: {}
        });

        // Trigger background indexing
        const indexingService = require("../ai/services/indexingService");
        indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
            console.error(`Failed to trigger background indexing for ${document._id}:`, err);
        });

        return document;
    });

    return sendSuccess(res, 202, "Document upload scheduled in background.", task);
});

module.exports = {
    uploadDocument
};