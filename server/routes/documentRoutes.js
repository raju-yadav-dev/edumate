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
    dismissDocumentProcessing,
    dismissFailedQueue,
    getDocumentChunks,
    getIntegrityReport,
    repairDocument,
    repairAllDocuments,
    streamQueue,
    getChunkingLogs,
    clearChunkingLogs,
    startChunkingWorker,
    stopChunkingWorker,
    restartChunkingWorker,
    clearChunkingQueue,
    getLocalStorageTree,
    syncLocalStorage,
    getQdrantStatus,
    verifyQdrantVectors,
    deleteQdrantVectors,
    getChunkingAnalytics,
    getChunkingHealth
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

// Folder & Placeholder Management
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

// Mission 15: SSE Real-Time Queue & Log Streaming
router.get(
    "/queue/stream",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    streamQueue
);

// Mission 15: Queue, Logs & Worker Controls
router.get(
    "/queue/status",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    getQueueStatus
);
router.get(
    "/queue/health",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    getChunkingHealth
);
router.get(
    "/queue/logs",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    getChunkingLogs
);
router.post(
    "/queue/logs/clear",
    authorizeRoles("admin", "super_admin"),
    clearChunkingLogs
);
router.post(
    "/queue/clear",
    authorizeRoles("admin", "super_admin"),
    clearChunkingQueue
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
    "/worker/start",
    authorizeRoles("admin", "super_admin"),
    startChunkingWorker
);
router.post(
    "/worker/stop",
    authorizeRoles("admin", "super_admin"),
    stopChunkingWorker
);
router.post(
    "/worker/restart",
    authorizeRoles("admin", "super_admin"),
    restartChunkingWorker
);

// Mission 15: Local Storage Explorer & Sync
router.get(
    "/storage/tree",
    authorizeRoles("admin", "super_admin"),
    getLocalStorageTree
);
router.post(
    "/storage/scan-sync",
    authorizeRoles("admin", "super_admin"),
    syncLocalStorage
);

// Mission 15: Qdrant Index Viewer & Management
router.get(
    "/qdrant/status",
    authorizeRoles("admin", "super_admin"),
    getQdrantStatus
);
router.post(
    "/qdrant/verify",
    authorizeRoles("admin", "super_admin"),
    verifyQdrantVectors
);
router.delete(
    "/qdrant/vectors/:documentId",
    authorizeRoles("admin", "super_admin"),
    deleteQdrantVectors
);

// Mission 15: Chunk Analytics Dashboard
router.get(
    "/chunking/analytics",
    authorizeRoles("admin", "super_admin"),
    getChunkingAnalytics
);

// Per-Document Queue & Job Controls
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
router.post(
    "/:documentId/dismiss",
    authorizeRoles("admin", "super_admin"),
    dismissDocumentProcessing
);
router.post(
    "/queue/dismiss-failed",
    authorizeRoles("admin", "super_admin"),
    dismissFailedQueue
);

// Integrity & Auto-Repair
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

// Legacy / Admin Operations
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
