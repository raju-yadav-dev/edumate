const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const documentUpload = require("../middleware/documentUploadMiddleware");
const {
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
} = require("../controllers/documentController");

const router = express.Router();

router.use(authenticate);

router.get("/", listDocuments);
router.get(
    "/jobs/status",
    authorizeRoles("admin", "super_admin"),
    getJobsStatus
);
router.post(
    "/reindex",
    authorizeRoles("admin", "super_admin"),
    bulkReindexDocuments
);
router.put(
    "/bulk-move",
    authorizeRoles("admin", "super_admin"),
    bulkMoveDocuments
);
router.put(
    "/bulk-copy",
    authorizeRoles("admin", "super_admin"),
    bulkCopyDocuments
);
router.delete(
    "/bulk-delete",
    authorizeRoles("admin", "super_admin"),
    bulkDeleteDocuments
);
router.post(
    "/retry-failed",
    authorizeRoles("admin", "super_admin"),
    retryFailedDocuments
);
router.post(
    "/",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    documentUpload.single("document"),
    uploadDocument
);
router.put(
    "/:documentId",
    authorizeRoles("admin", "super_admin"),
    documentUpload.single("document"),
    replaceDocument
);
router.put(
    "/:documentId/rename",
    authorizeRoles("admin", "super_admin"),
    renameDocument
);
router.put(
    "/:documentId/move",
    authorizeRoles("admin", "super_admin"),
    moveDocument
);
router.put(
    "/:documentId/copy",
    authorizeRoles("admin", "super_admin"),
    copyDocument
);
router.put(
    "/:documentId/ignore",
    authorizeRoles("admin", "super_admin"),
    ignoreFailedDocument
);
router.put(
    "/:documentId/restore",
    authorizeRoles("admin", "super_admin"),
    restoreDocument
);
router.delete(
    "/:documentId",
    authorizeRoles("admin", "super_admin"),
    deleteDocument
);
router.delete(
    "/:documentId/permanent",
    authorizeRoles("admin", "super_admin"),
    permanentDeleteDocument
);
router.post(
    "/rebuild",
    authorizeRoles("admin", "super_admin"),
    rebuildAllEmbeddings
);
router.post(
    "/:documentId/reindex",
    authorizeRoles("admin", "super_admin"),
    reindexDocument
);
router.post(
    "/:documentId/embeddings/rebuild",
    authorizeRoles("admin", "super_admin"),
    reindexDocument
);
router.post(
    "/:documentId/duplicate",
    authorizeRoles("admin", "super_admin"),
    duplicateDocument
);

module.exports = router;
