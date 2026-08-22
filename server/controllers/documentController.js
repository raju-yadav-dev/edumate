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
    bulkDeleteDocuments
};
