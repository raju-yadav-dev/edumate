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

    if (!req.file || !req.file.buffer) {
        return res.status(400).json({
            success: false,
            message: "File buffer is required."
        });
    }

    const file = {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: Buffer.from(req.file.buffer)
    };
    const body = { ...req.body };

    const task = taskRegistry.createTask(`Upload document: ${file.originalname} (via upload route)`, "upload_document");

    taskRegistry.addTask(task.id, async () => {
        let extension = path.extname(file.originalname) || "";
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
        const targetFolder = body.folder || body.folderPath || (category ? `file_explorer/${category}` : "file_explorer");
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