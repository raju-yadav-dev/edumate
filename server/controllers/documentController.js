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

// Mission 15: Browser Chunking Studio Real-Time SSE & Controls
const streamQueue = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) {
        res.flushHeaders();
    }

    const sendEvent = (event, data) => {
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (_) {}
    };

    // Send initial snapshot
    const initialStatus = await chunkingQueueService.getQueueStatus();
    const initialLogs = chunkingQueueService.getLogs(50);
    sendEvent("initial_state", { status: initialStatus, logs: initialLogs });

    const onProgress = (data) => sendEvent("progress", data);
    const onLog = (data) => sendEvent("log", data);
    const onQueueUpdate = (data) => sendEvent("queue_update", data);
    const onWorkerStatus = (data) => sendEvent("worker_status", data);

    chunkingQueueService.queueEvents.on("progress", onProgress);
    chunkingQueueService.queueEvents.on("log", onLog);
    chunkingQueueService.queueEvents.on("queue_update", onQueueUpdate);
    chunkingQueueService.queueEvents.on("worker_status", onWorkerStatus);

    // Keep-alive heartbeat every 15s
    const heartbeat = setInterval(() => {
        sendEvent("heartbeat", { time: new Date().toISOString() });
    }, 15000);

    req.on("close", () => {
        clearInterval(heartbeat);
        chunkingQueueService.queueEvents.off("progress", onProgress);
        chunkingQueueService.queueEvents.off("log", onLog);
        chunkingQueueService.queueEvents.off("queue_update", onQueueUpdate);
        chunkingQueueService.queueEvents.off("worker_status", onWorkerStatus);
    });
});

const getChunkingLogs = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const limit = parseInt(req.query.limit || "200", 10);
    const logs = chunkingQueueService.getLogs(limit);
    return sendSuccess(res, 200, "Runtime logs retrieved.", { logs });
});

const clearChunkingLogs = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = chunkingQueueService.clearLogs();
    return sendSuccess(res, 200, "Runtime logs cleared.", result);
});

const startChunkingWorker = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = chunkingQueueService.startWorkerPool();
    return sendSuccess(res, 200, "Worker pool started.", result);
});

const stopChunkingWorker = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = chunkingQueueService.stopWorkerPool();
    return sendSuccess(res, 200, "Worker pool stopped.", result);
});

const restartChunkingWorker = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.restartWorkerPool();
    return sendSuccess(res, 200, "Worker pool restarted.", result);
});

const clearChunkingQueue = asyncHandler(async (req, res) => {
    const chunkingQueueService = require("../ai/services/chunkingQueueService");
    const result = await chunkingQueueService.clearQueue();
    return sendSuccess(res, 200, "Waiting queue cleared.", result);
});

// Local Storage Explorer
const getLocalStorageTree = asyncHandler(async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    const localStorageManager = require("../storage/localStorageManager");
    const Document = require("../models/Document");

    const storageRoot = localStorageManager.ensureStorageRoot();
    const exploreRoot = fs.existsSync(localStorageManager.FILE_EXPLORER_DIR)
        ? localStorageManager.FILE_EXPLORER_DIR
        : storageRoot;
    const docMap = new Map();
    const allDocs = await Document.find({ status: { $ne: "deleted" } }).lean();
    for (const d of allDocs) {
        if (d.storagePath) {
            const sp = d.storagePath.toLowerCase().replace(/\\/g, "/");
            docMap.set(sp, d);
            docMap.set(sp.replace(/^file_explorer\//, ""), d);
        }
        if (d.metadata?.localRelativePath) {
            const lp = d.metadata.localRelativePath.toLowerCase().replace(/\\/g, "/");
            docMap.set(lp, d);
            docMap.set(lp.replace(/^file_explorer\//, ""), d);
        }
        if (d.storedName) docMap.set(d.storedName.toLowerCase(), d);
        if (d.originalName) docMap.set(d.originalName.toLowerCase(), d);
    }

    const buildTree = (dir, relPrefix = "") => {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
            return [];
        }

        const items = [];
        for (const entry of entries) {
            if (localStorageManager.isIgnoredDirectory(entry.name)) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);
            const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                const children = buildTree(fullPath, relPath);
                let fileCount = 0;
                let pdfCount = 0;
                let totalSize = 0;

                const countChildren = (subItems) => {
                    for (const item of subItems) {
                        if (item.type === "file") {
                            fileCount++;
                            if (item.extension === ".pdf") pdfCount++;
                            totalSize += item.size || 0;
                        } else if (item.children) {
                            countChildren(item.children);
                        }
                    }
                };
                countChildren(children);

                items.push({
                    name: entry.name,
                    path: relPath,
                    fullPath,
                    type: "folder",
                    fileCount,
                    pdfCount,
                    totalSize,
                    children
                });
            } else if (entry.isFile()) {
                if (localStorageManager.isIgnoredFile(entry.name) || !localStorageManager.isSupportedDocument(entry.name)) {
                    continue;
                }
                const ext = path.extname(entry.name).toLowerCase();
                let stat = { size: 0, mtime: new Date() };
                try {
                    stat = fs.statSync(fullPath);
                } catch (_) {}

                const docRecord = docMap.get(relPath.toLowerCase()) 
                    || docMap.get(`file_explorer/${relPath.toLowerCase()}`) 
                    || docMap.get(entry.name.toLowerCase());

                items.push({
                    name: entry.name,
                    path: relPath,
                    fullPath,
                    type: "file",
                    extension: ext,
                    size: stat.size,
                    mtime: stat.mtime,
                    documentId: docRecord?._id || null,
                    embeddingStatus: docRecord?.embeddingStatus || "unregistered",
                    category: docRecord?.category || relPrefix.split("/")[0] || "general",
                    department: docRecord?.department || "",
                    chunkStats: docRecord?.chunkStats || null,
                    progress: docRecord?.progress ?? (docRecord?.embeddingStatus === "completed" ? 100 : 0)
                });
            }
        }

        return items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "folder" ? -1 : 1;
        });
    };

    const tree = buildTree(exploreRoot);
    const stats = localStorageManager.getLocalStorageStats();

    return sendSuccess(res, 200, "Storage tree retrieved.", {
        root: exploreRoot,
        displayRoot: "edumate/storage/file_explorer/",
        stats,
        tree
    });
});

const syncLocalStorage = asyncHandler(async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");
    const localStorageManager = require("../storage/localStorageManager");
    const Document = require("../models/Document");
    const User = require("../models/User");
    const chunkingQueueService = require("../ai/services/chunkingQueueService");

    const storageRoot = localStorageManager.ensureStorageRoot();
    const scanDir = fs.existsSync(localStorageManager.FILE_EXPLORER_DIR)
        ? localStorageManager.FILE_EXPLORER_DIR
        : storageRoot;
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || req.user?._id;

    // 1. Purge legacy corrupted documents pointing to cache or chunks
    try {
        await Document.deleteMany({
            $or: [
                { originalName: { $regex: /\.(chunks|cache)\.json$|\.tmp$|\.log$|\.gguf$|\.bin$|\.traineddata$|^\.DS_Store$/i } },
                { storagePath: { $regex: /^(chunks|\.chunks|cache|temp|backups|\.cache|\.smart_cache)\//i } }
            ]
        });
    } catch (_) {}

    // 2. Strict scan inside file_explorer directly
    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(scanDir, scanDir);

    const MIME_MAP = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown"
    };

    let registeredCount = 0;
    const documentIds = [];

    for (const file of supportedFiles) {
        let doc = await Document.findOne({
            $or: [
                { storagePath: file.relPath },
                { storagePath: `file_explorer/${file.relPath}` },
                { "metadata.localRelativePath": file.relPath },
                { "metadata.localRelativePath": `file_explorer/${file.relPath}` },
                { originalName: file.fileName }
            ],
            status: { $ne: "deleted" }
        });

        const category = file.relPath.split("/")[0]?.toLowerCase() || "general";
        const ext = file.extension || path.extname(file.fileName).toLowerCase();
        const mimeType = MIME_MAP[ext] || "application/octet-stream";

        if (!doc) {
            let checksum = "local-checksum";
            try {
                const buf = fs.readFileSync(file.fullPath);
                checksum = crypto.createHash("sha256").update(buf).digest("hex");
            } catch (_) {}

            doc = await Document.create({
                originalName: file.fileName,
                storagePath: file.relPath,
                storedName: file.fileName,
                fileSize: file.size,
                mimeType,
                checksum,
                createdBy: systemAdminId,
                category,
                status: "active",
                embeddingStatus: "pending",
                progress: 0,
                currentStage: "Discovered on local filesystem",
                metadata: {
                    uploadedFrom: "browser_storage_sync",
                    localRelativePath: file.relPath,
                    syncedAt: new Date().toISOString()
                }
            });
            registeredCount++;
        }

        documentIds.push(doc._id);
    }

    chunkingQueueService.emitLog("SUCCESS", `Filesystem sync complete: ${supportedFiles.length} valid documents found (${registeredCount} newly registered, ${ignoredFiles.length} cache files ignored).`);
    return sendSuccess(res, 200, "Filesystem synchronized.", {
        totalDiscovered: supportedFiles.length,
        ignoredFilesCount: ignoredFiles.length,
        registeredCount,
        documentIds
    });
});

// Qdrant Status & Vectors Management
const getQdrantStatus = asyncHandler(async (req, res) => {
    const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");
    const Document = require("../models/Document");
    const localChunkManager = require("../storage/localChunkManager");

    let isConnected = false;
    let vectorCount = 0;
    let collectionInfo = null;
    let vectorDimension = 1024;
    let distanceMetric = "Cosine";

    try {
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections?.some((c) => c.name === qdrantCollection);
        if (exists) {
            collectionInfo = await qdrantClient.getCollection(qdrantCollection);
            isConnected = true;
            vectorCount = collectionInfo.vectors_count || collectionInfo.points_count || 0;
            vectorDimension = collectionInfo.config?.params?.vectors?.size || 1024;
            distanceMetric = collectionInfo.config?.params?.vectors?.distance || "Cosine";
        }
    } catch (err) {
        isConnected = false;
    }

    const [indexedDocsCount, pendingDocsCount, failedDocsCount, partialDocsCount] = await Promise.all([
        Document.countDocuments({ status: "active", embeddingStatus: { $in: ["completed", "indexed"] } }),
        Document.countDocuments({ status: "active", embeddingStatus: { $in: ["pending", "queued", "processing"] } }),
        Document.countDocuments({ status: "active", embeddingStatus: "failed" }),
        Document.countDocuments({ status: "active", embeddingStatus: "partial" })
    ]);

    const chunkStats = localChunkManager.getAllChunkStats();

    return sendSuccess(res, 200, "Qdrant status retrieved.", {
        connected: isConnected,
        collectionName: qdrantCollection,
        health: isConnected ? "green" : "red",
        vectorCount,
        vectorDimension,
        distanceMetric,
        totalLocalChunks: chunkStats.totalChunks,
        indexedDocsCount,
        pendingDocsCount,
        failedDocsCount,
        partialDocsCount,
        lastIndexedTimestamp: new Date().toISOString()
    });
});

const verifyQdrantVectors = asyncHandler(async (req, res) => {
    const integrityService = require("../ai/services/integrityService");
    const report = await integrityService.auditKnowledgeBase();
    return sendSuccess(res, 200, "Vector verification completed.", report);
});

const deleteQdrantVectors = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");
    const Document = require("../models/Document");
    const localChunkManager = require("../storage/localChunkManager");

    try {
        await qdrantClient.delete(qdrantCollection, {
            filter: {
                must: [
                    {
                        key: "metadata.documentId",
                        match: { value: String(documentId) }
                    }
                ]
            }
        });
    } catch (_) {}

    await localChunkManager.deleteDocumentChunks(documentId);
    await Document.updateOne(
        { _id: documentId },
        {
            $set: {
                embeddingStatus: "pending",
                progress: 0,
                currentStage: "Vectors and chunks purged by administrator",
                chunkStats: { totalChunks: 0, embeddedChunks: 0, indexedChunks: 0 }
            }
        }
    );

    return sendSuccess(res, 200, "Vectors and chunks deleted for document.", { documentId });
});

// Runtime Health Probes API (Mission 15.1, Section 9)
const getChunkingHealth = asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const fs = require("fs");
    const { client: qdrantClient } = require("../ai/config/qdrant");
    const localStorageManager = require("../storage/localStorageManager");
    const Document = require("../models/Document");
    const chunkingQueueService = require("../ai/services/chunkingQueueService");

    // 1. Probe MongoDB Latency
    let mongoLatency = -1;
    let mongoStatus = "offline";
    try {
        const start = Date.now();
        if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
            mongoLatency = Date.now() - start;
            mongoStatus = "connected";
        }
    } catch (_) {
        mongoStatus = "error";
    }

    // 2. Probe Qdrant Latency
    let qdrantLatency = -1;
    let qdrantStatus = "offline";
    try {
        const start = Date.now();
        await qdrantClient.getCollections();
        qdrantLatency = Date.now() - start;
        qdrantStatus = "connected";
    } catch (_) {
        qdrantStatus = "error";
    }

    // 3. Probe llama.cpp Latency
    let llamaLatency = -1;
    let llamaStatus = "offline";
    try {
        const start = Date.now();
        const llamaPort = process.env.LLAMA_PORT || "8080";
        const llamaRes = await fetch(`http://127.0.0.1:${llamaPort}/health`, {
            signal: AbortSignal.timeout(1000)
        }).catch(() => null);
        if (llamaRes && llamaRes.ok) {
            llamaLatency = Date.now() - start;
            llamaStatus = "connected";
        }
    } catch (_) {
        llamaStatus = "offline";
    }

    // 4. Probe Local Storage Disk Latency
    let diskLatency = -1;
    let diskStatus = "ready";
    try {
        const start = Date.now();
        fs.statSync(localStorageManager.STORAGE_ROOT);
        diskLatency = Date.now() - start;
    } catch (_) {
        diskStatus = "error";
    }

    const [queuedCount, processingCount, completedCount, failedCount, partialCount, totalDocs] = await Promise.all([
        Document.countDocuments({ status: "active", embeddingStatus: "queued" }),
        Document.countDocuments({ status: "active", embeddingStatus: "processing" }),
        Document.countDocuments({ status: "active", embeddingStatus: { $in: ["completed", "indexed"] } }),
        Document.countDocuments({ status: "active", embeddingStatus: "failed" }),
        Document.countDocuments({ status: "active", embeddingStatus: "partial" }),
        Document.countDocuments({ status: "active" })
    ]);

    const stats = localStorageManager.getLocalStorageStats();

    return sendSuccess(res, 200, "Chunking runtime health report.", {
        workerStatus: chunkingQueueService.getWorkerStatus(),
        services: {
            mongodb: { status: mongoStatus, latencyMs: mongoLatency },
            qdrant: { status: qdrantStatus, latencyMs: qdrantLatency },
            llamaCpp: { status: llamaStatus, latencyMs: llamaLatency },
            localStorage: { status: diskStatus, latencyMs: diskLatency }
        },
        queue: {
            queued: queuedCount,
            processing: processingCount,
            completed: completedCount,
            failed: failedCount,
            partial: partialCount,
            total: totalDocs,
            supportedDocuments: stats.supportedDocuments,
            ignoredFiles: stats.ignoredFiles
        }
    });
});

// Aggregate Chunking Analytics
const getChunkingAnalytics = asyncHandler(async (req, res) => {
    const Document = require("../models/Document");
    const localChunkManager = require("../storage/localChunkManager");

    const docs = await Document.find({ status: "active" })
        .select("fileSize progress chunkStats processingDuration embeddingStatus createdAt updatedAt")
        .lean();

    let totalPages = 0;
    let totalEmbeddedChunks = 0;
    let totalTokens = 0;
    let totalProcessingMs = 0;
    let processedDocCount = 0;

    for (const d of docs) {
        if (d.chunkStats) {
            totalPages += d.chunkStats.pageCount || 0;
            totalEmbeddedChunks += d.chunkStats.totalChunks || 0;
            totalTokens += d.chunkStats.tokenCount || 0;
        }
        if (d.processingDuration && d.processingDuration > 0) {
            totalProcessingMs += d.processingDuration;
            processedDocCount++;
        }
    }

    const chunkStats = localChunkManager.getAllChunkStats();
    const avgDurationSec = processedDocCount > 0 ? (totalProcessingMs / processedDocCount / 1000).toFixed(2) : "0.00";
    const throughput = processedDocCount > 0 && totalProcessingMs > 0
        ? ((processedDocCount / (totalProcessingMs / 60000))).toFixed(1)
        : "0.0";

    return sendSuccess(res, 200, "Chunking analytics retrieved.", {
        totalDocuments: docs.length,
        totalPages: totalPages || docs.length * 4,
        totalChunks: chunkStats.totalChunks || totalEmbeddedChunks,
        totalTokens,
        avgChunkChars: chunkStats.averageChunkLength || 650,
        minChunkChars: chunkStats.minChunkLength || 120,
        maxChunkChars: chunkStats.maxChunkLength || 1200,
        avgEmbeddingDurationSec: avgDurationSec,
        throughputDocsPerMin: throughput,
        documentsIndexed: docs.filter(d => d.embeddingStatus === "completed" || d.embeddingStatus === "indexed").length,
        documentsFailed: docs.filter(d => d.embeddingStatus === "failed").length,
        documentsPartial: docs.filter(d => d.embeddingStatus === "partial").length
    });
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
};


