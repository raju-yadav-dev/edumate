const getDocumentService = () => require("../services/documentService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const uploadDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().uploadDocument({
        file: req.file,
        body: req.body,
        user: req.user
    });

    return sendSuccess(res, 201, "Document uploaded successfully.", document);
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
    await getDocumentService().archiveDocument({
        documentId: req.params.documentId,
        user: req.user
    });

    return sendSuccess(res, 200, "Document deleted successfully.");
});

const replaceDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().replaceDocument({
        documentId: req.params.documentId,
        file: req.file,
        body: req.body,
        user: req.user
    });

    return sendSuccess(res, 200, "Document replaced successfully.", document);
});

const renameDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().renameDocument({
        documentId: req.params.documentId,
        originalName: req.body.originalName,
        user: req.user
    });

    return sendSuccess(res, 200, "Document renamed successfully.", document);
});

const moveDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().moveDocument({
        documentId: req.params.documentId,
        category: req.body.category,
        user: req.user
    });

    return sendSuccess(res, 200, "Document moved successfully.", document);
});

const reindexDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().reindexDocument({
        documentId: req.params.documentId,
        user: req.user
    });

    return sendSuccess(res, 200, "Document indexing initiated in background.", document);
});

const copyDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().copyDocument({
        documentId: req.params.documentId,
        category: req.body.category,
        user: req.user
    });

    return sendSuccess(res, 201, "Document copied successfully.", document);
});

const rebuildAllEmbeddings = asyncHandler(async (req, res) => {
    const result = await getDocumentService().rebuildAllEmbeddings();

    return sendSuccess(res, 200, `Rebuilding initiated for ${result.count} documents.`, result);
});

const bulkReindexDocuments = asyncHandler(async (req, res) => {
    const { category, ids } = req.body;
    const result = await getDocumentService().bulkReindex({ category, ids, user: req.user });
    return sendSuccess(res, 200, "Bulk reindexing initiated.", result);
});

const getJobsStatus = asyncHandler(async (req, res) => {
    const result = await getDocumentService().getJobsStatus();
    return sendSuccess(res, 200, "Jobs status retrieved.", result);
});

const retryFailedDocuments = asyncHandler(async (req, res) => {
    const result = await getDocumentService().retryFailed({ user: req.user });
    return sendSuccess(res, 200, "Retrying failed indexing documents.", result);
});

const ignoreFailedDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().ignoreFailed({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document index status set to ignored.", document);
});

const restoreDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().restoreDocument({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document restored from recycle bin.", document);
});

const permanentDeleteDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().permanentDeleteDocument({ documentId: req.params.documentId, user: req.user });
    return sendSuccess(res, 200, "Document permanently deleted.", document);
});

const duplicateDocument = asyncHandler(async (req, res) => {
    const document = await getDocumentService().duplicateDocument({ documentId: req.params.documentId, user: req.user });

    return sendSuccess(res, 201, "Document duplicated successfully.", document);
});

const bulkMoveDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const result = await getDocumentService().bulkMove({ ids, category, user: req.user });
    return sendSuccess(res, 200, "Documents moved successfully.", result);
});

const bulkCopyDocuments = asyncHandler(async (req, res) => {
    const { ids, category } = req.body;
    const result = await getDocumentService().bulkCopy({ ids, category, user: req.user });
    return sendSuccess(res, 201, "Documents copied successfully.", result);
});

const bulkDeleteDocuments = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    const result = await getDocumentService().bulkDelete({ ids, user: req.user });
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
