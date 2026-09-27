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
} = require("../controllers/documentController");

const router = express.Router();

router.use(authenticate);

// Listing & Previews
router.get("/", listDocuments);
router.get("/:documentId/preview", previewDocument);
router.get("/:documentId/download", downloadDocument);
router.get(
    "/:documentId/chunks",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    getDocumentChunks
);

// Folder & Placeholder Management (Mission 9.1)
router.post(
    "/placeholder",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    createPlaceholder
);
router.put(
    "/folder/rename",
    authorizeRoles("admin", "super_admin"),
    renameFolder
);
router.delete(
    "/folder",
    authorizeRoles("admin", "super_admin"),
    deleteFolder
);
router.put(
    "/bulk-restore",
    authorizeRoles("admin", "super_admin"),
    bulkRestoreDocuments
);

// Queue Management (Mission 9.2 & 9.3)
router.get(
    "/queue/status",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    getQueueStatus
);
router.post(
    "/queue/pause",
    authorizeRoles("admin", "super_admin"),
    pauseQueue
);
router.post(
    "/queue/resume",
    authorizeRoles("admin", "super_admin"),
    resumeQueue
);
router.post(
    "/queue/enqueue",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    enqueueDocuments
);
router.post(
    "/queue/retry-failed",
    authorizeRoles("admin", "super_admin"),
    retryFailedQueue
);
router.post(
    "/:documentId/cancel",
    authorizeRoles("admin", "super_admin"),
    cancelDocumentProcessing
);
router.post(
    "/:documentId/resume",
    authorizeRoles("admin", "super_admin"),
    resumeDocumentProcessing
);
router.post(
    "/:documentId/retry",
    authorizeRoles("admin", "super_admin"),
    retryDocumentProcessing
);

// Integrity & Auto-Repair (Mission 9.5)
router.get(
    "/integrity/report",
    authorizeRoles("admin", "super_admin"),
    getIntegrityReport
);
router.post(
    "/integrity/repair-all",
    authorizeRoles("admin", "super_admin"),
    repairAllDocuments
);
router.post(
    "/:documentId/repair",
    authorizeRoles("admin", "super_admin"),
    repairDocument
);

// Existing Legacy / Admin Operations
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

