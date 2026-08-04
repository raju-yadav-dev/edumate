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

module.exports = {
    uploadDocument,
    listDocuments,
    deleteDocument,
    replaceDocument,
    renameDocument,
    moveDocument,
    copyDocument,
    reindexDocument,
    rebuildAllEmbeddings
};
