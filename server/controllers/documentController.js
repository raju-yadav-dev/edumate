const documentService = require("../services/documentService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const uploadDocument = asyncHandler(async (req, res) => {
    const document = await documentService.uploadDocument({
        file: req.file,
        body: req.body,
        user: req.user
    });

    return sendSuccess(res, 201, "Document uploaded successfully.", document);
});

const listDocuments = asyncHandler(async (req, res) => {
    const result = await documentService.listDocuments({
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
    await documentService.archiveDocument({
        documentId: req.params.documentId,
        user: req.user
    });

    return sendSuccess(res, 200, "Document deleted successfully.");
});

const replaceDocument = asyncHandler(async (req, res) => {
    const document = await documentService.replaceDocument({
        documentId: req.params.documentId,
        file: req.file,
        body: req.body,
        user: req.user
    });

    return sendSuccess(res, 200, "Document replaced successfully.", document);
});

const renameDocument = asyncHandler(async (req, res) => {
    const document = await documentService.renameDocument({
        documentId: req.params.documentId,
        originalName: req.body.originalName,
        user: req.user
    });

    return sendSuccess(res, 200, "Document renamed successfully.", document);
});

const moveDocument = asyncHandler(async (req, res) => {
    const document = await documentService.moveDocument({
        documentId: req.params.documentId,
        category: req.body.category,
        user: req.user
    });

    return sendSuccess(res, 200, "Document moved successfully.", document);
});

const reindexDocument = asyncHandler(async (req, res) => {
    const document = await documentService.reindexDocument({
        documentId: req.params.documentId,
        user: req.user
    });

    return sendSuccess(res, 200, "Document indexing initiated in background.", document);
});

const copyDocument = asyncHandler(async (req, res) => {
    const document = await documentService.copyDocument({
        documentId: req.params.documentId,
        category: req.body.category,
        user: req.user
    });

    return sendSuccess(res, 201, "Document copied successfully.", document);
});

const rebuildAllEmbeddings = asyncHandler(async (req, res) => {
    const result = await documentService.rebuildAllEmbeddings();

    return sendSuccess(res, 200, `Rebuilding initiated for ${result.count} documents.`, result);
});

const bulkReindexDocuments = asyncHandler(async (req, res) => {
    const { category, ids } = req.body;
    const result = await documentService.bulkReindex({ category, ids, user: req.user });
    return sendSuccess(res, 200, "Bulk reindexing initiated.", result);
});

const getJobsStatus = asyncHandler(async (req, res) => {
    const result = await documentService.getJobsStatus();
    return sendSuccess(res, 200, "Jobs status retrieved.", result);
});

const retryFailedDocuments = asyncHandler(async (req, res) => {
    const result = await documentService.retryFailed({ user: req.user });
    return sendSuccess(res, 200, "Retrying failed indexing documents.", result);
});

const ignoreFailedDocument = asyncHandler(async (req, res) => {
    const document = await documentService.ignoreFailed({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document index status set to ignored.", document);
});

const restoreDocument = asyncHandler(async (req, res) => {
    const document = await documentService.restoreDocument({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document restored from recycle bin.", document);
});

const permanentDeleteDocument = asyncHandler(async (req, res) => {
    const document = await documentService.permanentDeleteDocument({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document permanently deleted.", document);
});

const duplicateDocument = asyncHandler(async (req, res) => {
    const document = await documentService.duplicateDocument({ documentId: req.params.documentId, user: req.user });

    return sendSuccess(res, 201, "Document duplicated successfully.", document);
});

const bulkMoveDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const result = await documentService.bulkMove({ ids, category, user: req.user });
    return sendSuccess(res, 200, "Documents moved successfully.", result);
});

const bulkCopyDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const result = await documentService.bulkCopy({ ids, category, user: req.user });
    return sendSuccess(res, 201, "Documents copied successfully.", result);
});

const bulkDeleteDocuments = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await documentService.bulkDelete({ ids, user: req.user });
    return sendSuccess(res, 200, "Documents deleted successfully.", result);
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
