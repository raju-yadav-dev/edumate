const getDocumentService = () => require("../services/documentService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const taskRegistry = require("../utils/taskRegistry");

const uploadDocument = asyncHandler(async (req, res) => {
    const { getEmbeddingAvailability } = require("../ai/config/embeddings");
    const status = await getEmbeddingAvailability();
    if (!status.available) {
        return res.status(503).json({
            success: false,
            message: status.reason || "Embedding provider unavailable"
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Document file is required."
        });
    }

    const task = taskRegistry.createTask(`Upload document: ${req.file.originalname}`, "upload_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().uploadDocument({
            file: req.file,
            body: req.body,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document upload scheduled in background.", task);
});

const listDocuments = asyncHandler(async (req, res) => {
    const result = await getDocumentService().listDocuments({
        query: req.query,
        user: req.user
    });

    return sendSuccess(
        res,
        200,
        "Documents retrieved successfully.",
        result.documents,
        null,
        result.pagination
    );
});

const deleteDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Archive/Delete document: ${req.params.documentId}`, "delete_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().archiveDocument({
            documentId: req.params.documentId,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document deletion scheduled in background.", task);
});

const replaceDocument = asyncHandler(async (req, res) => {
    const { getEmbeddingAvailability } = require("../ai/config/embeddings");
    const status = await getEmbeddingAvailability();
    if (!status.available) {
        return res.status(503).json({
            success: false,
            message: status.reason || "Embedding provider unavailable"
        });
    }

    const task = taskRegistry.createTask(`Replace document: ${req.params.documentId}`, "replace_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().replaceDocument({
            documentId: req.params.documentId,
            file: req.file,
            body: req.body,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document replacement scheduled in background.", task);
});

const renameDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Rename document: ${req.params.documentId} to ${req.body.originalName}`, "rename_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().renameDocument({
            documentId: req.params.documentId,
            originalName: req.body.originalName,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document renaming scheduled in background.", task);
});

const moveDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Move document: ${req.params.documentId} to category ${req.body.category}`, "move_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().moveDocument({
            documentId: req.params.documentId,
            category: req.body.category,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document move scheduled in background.", task);
});

const reindexDocument = asyncHandler(async (req, res) => {
    const { getEmbeddingAvailability } = require("../ai/config/embeddings");
    const status = await getEmbeddingAvailability();
    if (!status.available) {
        return res.status(503).json({
            success: false,
            message: status.reason || "Embedding provider unavailable"
        });
    }

    const task = taskRegistry.createTask(`Reindex document: ${req.params.documentId}`, "reindex_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().reindexDocument({
            documentId: req.params.documentId,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document reindexing scheduled in background.", task);
});

const copyDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Copy document: ${req.params.documentId} to category ${req.body.category}`, "copy_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().copyDocument({
            documentId: req.params.documentId,
            category: req.body.category,
            user: req.user
        });
    });

    return sendSuccess(res, 202, "Document copy scheduled in background.", task);
});

const rebuildAllEmbeddings = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask("Rebuild all document embeddings", "rebuild_all_embeddings");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().rebuildAllEmbeddings();
    });

    return sendSuccess(res, 202, "Rebuilding of all embeddings scheduled in background.", task);
});

const bulkReindexDocuments = asyncHandler(async (req, res) => {
    const { getEmbeddingAvailability } = require("../ai/config/embeddings");
    const status = await getEmbeddingAvailability();
    if (!status.available) {
        return res.status(503).json({
            success: false,
            message: status.reason || "Embedding provider unavailable"
        });
    }

    const { category, ids } = req.body;
    const task = taskRegistry.createTask(`Bulk reindex documents for category ${category || "all"}`, "bulk_reindex");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().bulkReindex({ category, ids, user: req.user });
    });

    return sendSuccess(res, 202, "Bulk reindexing scheduled in background.", task);
});

const getJobsStatus = asyncHandler(async (req, res) => {
    const result = await getDocumentService().getJobsStatus();
    return sendSuccess(res, 200, "Jobs status retrieved.", result);
});

const retryFailedDocuments = asyncHandler(async (req, res) => {
    const { getEmbeddingAvailability } = require("../ai/config/embeddings");
    const status = await getEmbeddingAvailability();
    if (!status.available) {
        return res.status(503).json({
            success: false,
            message: status.reason || "Embedding provider unavailable"
        });
    }

    const task = taskRegistry.createTask("Retry failed documents indexing", "retry_failed");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().retryFailed({ user: req.user });
    });

    return sendSuccess(res, 202, "Retrying failed indexing documents scheduled in background.", task);
});

const ignoreFailedDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Ignore failed indexing for document: ${req.params.documentId}`, "ignore_failed");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().ignoreFailed({ documentId: req.params.documentId, user: req.user });
    });

    return sendSuccess(res, 202, "Setting document status to ignored scheduled in background.", task);
});

const restoreDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Restore document: ${req.params.documentId}`, "restore_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().restoreDocument({ documentId: req.params.documentId, user: req.user });
    });

    return sendSuccess(res, 202, "Document restoration scheduled in background.", task);
});

const permanentDeleteDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Permanently delete document: ${req.params.documentId}`, "permanent_delete");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().permanentDeleteDocument({ documentId: req.params.documentId, user: req.user });
    });

    return sendSuccess(res, 202, "Document permanent deletion scheduled in background.", task);
});

const duplicateDocument = asyncHandler(async (req, res) => {
    const task = taskRegistry.createTask(`Duplicate document: ${req.params.documentId}`, "duplicate_document");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().duplicateDocument({ documentId: req.params.documentId, user: req.user });
    });

    return sendSuccess(res, 202, "Document duplication scheduled in background.", task);
});

const bulkMoveDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const task = taskRegistry.createTask(`Bulk move ${ids ? ids.length : 0} documents to category ${category}`, "bulk_move");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().bulkMove({ ids, category, user: req.user });
    });

    return sendSuccess(res, 202, "Bulk move scheduled in background.", task);
});

const bulkCopyDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const task = taskRegistry.createTask(`Bulk copy ${ids ? ids.length : 0} documents to category ${category}`, "bulk_copy");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().bulkCopy({ ids, category, user: req.user });
    });

    return sendSuccess(res, 202, "Bulk copy scheduled in background.", task);
});

const bulkDeleteDocuments = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const task = taskRegistry.createTask(`Bulk delete ${ids ? ids.length : 0} documents`, "bulk_delete");

    taskRegistry.addTask(task.id, async () => {
        return await getDocumentService().bulkDelete({ ids, user: req.user });
    });

    return sendSuccess(res, 202, "Bulk deletion scheduled in background.", task);
});

const downloadDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const Document = require("../models/Document");
    const localStorageManager = require("../storage/localStorageManager");

    const doc = await Document.findOne({ _id: documentId, status: { $ne: "deleted" } });
    if (!doc) {
        return res.status(404).json({ success: false, message: "Document not found." });
    }

    try {
        const fileBuffer = await localStorageManager.readFile(doc.storagePath);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.originalName || "document")}"`);
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        return res.send(fileBuffer);
    } catch (err) {
        return res.status(404).json({ success: false, message: "File not found on local storage: " + err.message });
    }
});

const previewDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const page = Number(req.query.page) || 1;
    const Document = require("../models/Document");

    const doc = await Document.findOne({ _id: documentId, status: { $ne: "deleted" } });
    if (!doc) {
        return res.status(404).json({ success: false, message: "Document not found." });
    }

    const downloadUrl = `/api/documents/${doc._id}/download`;

    return sendSuccess(res, 200, "Document preview details retrieved.", {
        documentId: doc._id,
        title: doc.originalName,
        category: doc.category,
        department: doc.department,
        mimeType: doc.mimeType,
        pageNumber: page,
        previewUrl: downloadUrl,
        downloadUrl: downloadUrl
    });
});


const createPlaceholder = asyncHandler(async (req, res) => {
    const { name, category, department, program } = req.body;
    const doc = await getDocumentService().createPlaceholderDocument({
        name,
        category,
        department,
        program,
        user: req.user
    });
    return sendSuccess(res, 201, "Placeholder document created successfully.", doc);
});

const renameFolder = asyncHandler(async (req, res) => {
    const { oldPath, newPath } = req.body;
    const result = await getDocumentService().renameFolder({ oldPath, newPath, user: req.user });
    return sendSuccess(res, 200, "Folder renamed successfully.", result);
});

const deleteFolder = asyncHandler(async (req, res) => {
    const { folderPath } = req.body;
    const result = await getDocumentService().deleteFolder({ folderPath, user: req.user });
    return sendSuccess(res, 200, "Folder deleted successfully.", result);
});

const bulkRestoreDocuments = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await getDocumentService().bulkRestore({ ids, user: req.user });
    return sendSuccess(res, 200, "Documents restored successfully.", result);
});

// Queue Controller Endpoints
const getQueueStatus = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const status = await chunkingQueueService.getQueueStatus();
    return sendSuccess(res, 200, "Queue status retrieved.", status);
});

const pauseQueue = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = chunkingQueueService.pauseQueue();
    return sendSuccess(res, 200, "Queue paused.", result);
});

const resumeQueue = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = chunkingQueueService.resumeQueue();
    return sendSuccess(res, 200, "Queue resumed.", result);
});

const enqueueDocuments = asyncHandler(async (req, res) => {
    const { documentIds, options } = req.body;
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.enqueueDocuments(documentIds, options);
    return sendSuccess(res, 200, "Documents enqueued for processing.", result);
});

const retryFailedQueue = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.retryFailed();
    return sendSuccess(res, 200, "Failed documents re-enqueued.", result);
});

const cancelDocumentProcessing = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.cancelDocument(documentId);
    return sendSuccess(res, 200, "Document processing cancelled.", result);
});

const resumeDocumentProcessing = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.resumeDocument(documentId);
    return sendSuccess(res, 200, "Document processing resumed.", result);
});

const retryDocumentProcessing = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.retryDocument(documentId);
    return sendSuccess(res, 200, "Document re-enqueued for processing.", result);
});

// Chunks & Integrity Controller Endpoints
const getDocumentChunks = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const integrityService = require("../ai/services/integrityService");
    const result = await integrityService.getDocumentChunks(documentId);
    return sendSuccess(res, 200, "Document chunks retrieved.", result);
});

const getIntegrityReport = asyncHandler(async (req, res) => {
    const integrityService = require("../ai/services/integrityService");
    const result = await integrityService.auditKnowledgeBase();
    return sendSuccess(res, 200, "Integrity audit report generated.", result);
});

const repairDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const integrityService = require("../ai/services/integrityService");
    const result = await integrityService.repairDocument(documentId);
    return sendSuccess(res, 200, "Document repair finished.", result);
});

const repairAllDocuments = asyncHandler(async (req, res) => {
    const integrityService = require("../ai/services/integrityService");
    const result = await integrityService.autoRepairAll();
    return sendSuccess(res, 200, "Auto-repair for all documents completed.", result);
});

module.exports = {
    uploadDocument,
    listDocuments,
    deleteDocument,
    replaceDocument,
    renameDocument,
    moveDocument,
    copyDocument,
    reindexDocument,
    rebuildAllEmbeddings,
    bulkReindexDocuments,
    getJobsStatus,
    retryFailedDocuments,
    ignoreFailedDocument,
    restoreDocument,
    permanentDeleteDocument,
    duplicateDocument,
    bulkMoveDocuments,
    bulkCopyDocuments,
    bulkDeleteDocuments,
    previewDocument,
    downloadDocument,
    createPlaceholder,
    renameFolder,
    deleteFolder,
    bulkRestoreDocuments,
    getQueueStatus,
    pauseQueue,
    resumeQueue,
    enqueueDocuments,
    retryFailedQueue,
    cancelDocumentProcessing,
    resumeDocumentProcessing,
    retryDocumentProcessing,
    getDocumentChunks,
    getIntegrityReport,
    repairDocument,
    repairAllDocuments
};

