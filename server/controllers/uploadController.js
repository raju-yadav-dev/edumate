const crypto = require("crypto");
const path = require("path");

const Document = require("../models/Document");
const localStorageManager = require("../storage/localStorageManager");
const asyncHandler = require("../utils/asyncHandler");
const taskRegistry = require("../utils/taskRegistry");
const { sendSuccess } = require("../utils/response");

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
        const targetFolder = req.body.folder || req.body.folderPath || (category ? `file_explorer/${category}` : "file_explorer");
        const cleanBase = targetFolder.replace(/^[/\\]+/, "").replace(/\\/g, "/");
        const baseDir = (!cleanBase.startsWith("file_explorer") && !cleanBase.startsWith("storage/file_explorer")) 
            ? `file_explorer/${cleanBase}` 
            : cleanBase;
        const storagePath = `${baseDir}/${uniqueName}`;

        //------------------------------------------
        // Save to Local Storage (edumate/storage/file_explorer/...)
        //------------------------------------------
        await localStorageManager.saveFile(storagePath, file.buffer);

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