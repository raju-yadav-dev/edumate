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

module.exports = {
    uploadDocument,
    listDocuments,
    deleteDocument
};
