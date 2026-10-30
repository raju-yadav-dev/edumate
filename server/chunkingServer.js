#!/usr/bin/env node

/**
 * EduMate Dedicated Chunking Server (Mission 15.2 Production Grade)
 * 
 * Runs a standalone, dedicated Express server on CHUNKING_PORT (default: 5001).
 * Powers the Browser Chunking Studio while keeping the primary chat backend independent.
 * 
 * Endpoints:
 *   - GET  /health                       Runtime health and service latencies
 *   - GET  /queue                        Current queue snapshot & statistics
 *   - GET  /queue/stream                 SSE endpoint for live queue progress
 *   - GET  /logs/stream                  SSE endpoint for live structured logs
 *   - GET  /queue/logs                   Fetch recent runtime log entries
 *   - POST /queue/logs/clear             Clear runtime log buffer
 *   - POST /queue/enqueue                Enqueue documents or categories
 *   - POST /queue/pause                  Pause background queue processing
 *   - POST /queue/resume                 Resume background queue processing
 *   - POST /queue/clear                  Clear waiting documents from queue
 *   - POST /queue/retry-all              Retry all failed / partial documents
 *   - POST /queue/retry/:documentId      Retry specific document
 *   - POST /worker/start                 Start worker pool
 *   - POST /worker/stop                  Stop worker pool
 *   - POST /worker/restart               Restart worker pool & recover stuck jobs
 *   - GET  /storage/tree                 Local storage explorer directory tree
 *   - POST /storage/scan-sync            Sync local storage documents with database
 *   - GET  /qdrant/status                Qdrant vector collection status
 *   - POST /qdrant/verify                Verify vector vs chunk integrity
 *   - DELETE /qdrant/vectors/:documentId Purge vectors and local chunks
 *   - GET  /chunking/analytics           Analytics overview
 *   - GET  /chunks/:documentId           Retrieve local chunk JSON
 *   - POST /upload                       Multipart document upload directly to storage
 *   - GET  /                             Web dashboard for Chunking Server
 */

const path = require("path");
const fs = require("fs");
const http = require("http");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });
require("dotenv").config({ path: path.resolve(__dirname, ".env"), override: true });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);
const multer = require("multer");

const localStorageManager = require("./storage/localStorageManager");
const localChunkManager = require("./storage/localChunkManager");
const Document = require("./models/Document");
const User = require("./models/User");
const chunkingQueueService = require("./ai/services/chunkingQueueService");
const integrityService = require("./ai/services/integrityService");
const { client: qdrantClient, collectionName: qdrantCollection, ensureCollection } = require("./ai/config/qdrant");

const CHUNKING_PORT = parseInt(process.env.CHUNKING_PORT || "5000", 10);
const startTime = Date.now();

const app = express();

// ==========================================
// Middleware
// ==========================================
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Cache-Control"]
}));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Active SSE connection tracking for graceful shutdown
const activeSseConnections = new Set();

const registerSseClient = (res) => {
    activeSseConnections.add(res);
    res.on("close", () => {
        activeSseConnections.delete(res);
    });
};

// ==========================================
// Multer Configuration for Multi-file & Folder Uploads
// ==========================================
const tempUploadDir = path.join(localStorageManager.STORAGE_ROOT, "temp", "uploads");
if (!fs.existsSync(tempUploadDir)) {
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

const stagingDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${uniqueSuffix}_${cleanName}`);
    }
});

const uploadMiddleware = multer({
    storage: stagingDiskStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    fileFilter: (req, file, cb) => {
        if (localStorageManager.isSupportedDocument(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file format: ${path.extname(file.originalname)}. Supported formats: PDF, DOCX, TXT, Markdown, and Images (PNG, JPG, JPEG, WEBP).`));
        }
    }
});

const safeUploadMiddleware = (req, res, next) => {
    uploadMiddleware.any()(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

// Helper for sending structured JSON responses
const sendJson = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: statusCode >= 200 && statusCode < 300,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

// Clean legacy corrupted records
async function cleanupCorruptedDocuments() {
    try {
        const corruptQuery = {
            $or: [
                { originalName: { $regex: /\.(chunks|cache)\.json$|\.tmp$|\.log$|\.gguf$|\.bin$|\.traineddata$|^\.DS_Store$/i } },
                { storagePath: { $regex: /^(chunks|\.chunks|cache|temp|backups|\.cache|\.smart_cache)\//i } },
                { "metadata.localRelativePath": { $regex: /^(chunks|\.chunks|cache|temp|backups|\.cache|\.smart_cache)\//i } }
            ]
        };
        const deleted = await Document.deleteMany(corruptQuery);
        if (deleted.deletedCount > 0) {
            console.log(`[ChunkingServer] Purged ${deleted.deletedCount} corrupted/cache records from MongoDB.`);
        }
    } catch (_) {}
}

// ==========================================
// 1. Health API (Mission 15.1 & 15.2)
// ==========================================
let cachedHealthSnapshot = null;
let lastHealthCheckTime = 0;
const HEALTH_CACHE_TTL_MS = 60000; // 60s cache

const handleHealthCheck = async (req, res) => {
    const isForce = req.query.force === "true";
    const now = Date.now();

    if (!isForce && cachedHealthSnapshot && (now - lastHealthCheckTime < HEALTH_CACHE_TTL_MS)) {
        // Quick update dynamic properties without network probing
        const queueStats = await chunkingQueueService.getQueueStatus();
        return sendJson(res, 200, "Chunking server runtime health (cached).", {
            ...cachedHealthSnapshot,
            uptimeSeconds: Math.floor((now - startTime) / 1000),
            workerStatus: chunkingQueueService.getWorkerStatus(),
            activeConnections: activeSseConnections.size,
            queueSummary: {
                concurrency: queueStats.concurrency,
                activeJobs: queueStats.activeJobs.length,
                workerUtilizationPct: queueStats.workerUtilizationPct !== undefined ? queueStats.workerUtilizationPct : (queueStats.concurrency > 0 ? Math.round((queueStats.activeJobs.length / queueStats.concurrency) * 100) : 0),
                waitingJobs: queueStats.totalQueued,
                completedJobs: queueStats.completedCount,
                failedJobs: queueStats.failedCount,
                totalDocuments: queueStats.totalCount
            }
        });
    }

    // 1. Probe MongoDB Latency
    let mongoLatency = -1;
    let mongoStatus = "offline";
    try {
        const mStart = Date.now();
        if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
            await Promise.race([
                mongoose.connection.db.admin().ping(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Mongo ping timeout")), 2000))
            ]);
            mongoLatency = Date.now() - mStart;
            mongoStatus = "connected";
        }
    } catch (_) {
        mongoStatus = "error";
    }

    // 2. Probe Qdrant Latency
    let qdrantLatency = -1;
    let qdrantStatus = "offline";
    try {
        const qStart = Date.now();
        await Promise.race([
            qdrantClient.getCollections(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Qdrant ping timeout")), 2500))
        ]);
        qdrantLatency = Date.now() - qStart;
        qdrantStatus = "connected";
    } catch (_) {
        qdrantStatus = "error";
    }

    // 3. Probe Embedding / LLM API Latency
    let aiLatency = -1;
    let aiStatus = "offline";
    let embeddingHealth = { status: "offline", latencyMs: -1 };
    let llamaHealth = { status: "offline", latencyMs: -1 };

    try {
        const { checkEmbeddingHealth, checkLlamaCppHealth } = require("./services/healthService");
        const [embRes, llmRes] = await Promise.allSettled([
            checkEmbeddingHealth(3000),
            checkLlamaCppHealth(1500)
        ]);

        if (embRes.status === "fulfilled" && embRes.value) {
            embeddingHealth = embRes.value;
        }
        if (llmRes.status === "fulfilled" && llmRes.value) {
            llamaHealth = llmRes.value;
        }

        if (embeddingHealth.status === "connected") {
            aiStatus = "connected";
            aiLatency = embeddingHealth.latencyMs || embeddingHealth.latency || 0;
        } else if (llamaHealth.status === "connected") {
            aiStatus = "connected";
            aiLatency = llamaHealth.latencyMs || llamaHealth.latency || 0;
        } else if (embeddingHealth.status === "degraded" || llamaHealth.status === "degraded") {
            aiStatus = "degraded";
            aiLatency = embeddingHealth.latencyMs > 0 ? embeddingHealth.latencyMs : llamaHealth.latencyMs;
        } else {
            aiStatus = "offline (optional fallback active)";
        }
    } catch (_) {
        aiStatus = "offline (optional fallback active)";
    }

    // 4. Probe Local Storage Latency
    let storageLatency = -1;
    let storageStatus = "offline";
    try {
        const sStart = Date.now();
        const storageRoot = localStorageManager.ensureStorageRoot();
        fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
        storageLatency = Date.now() - sStart;
        storageStatus = "connected";
    } catch (_) {
        storageStatus = "error";
    }

    const queueStats = await chunkingQueueService.getQueueStatus();

    const report = {
        service: "edumate-chunking-server",
        status: "online",
        port: CHUNKING_PORT,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        workerStatus: chunkingQueueService.getWorkerStatus(),
        activeConnections: activeSseConnections.size,
        services: {
            mongodb: { status: mongoStatus, latencyMs: mongoLatency },
            qdrant: { status: qdrantStatus, latencyMs: qdrantLatency, collection: qdrantCollection },
            llamaCpp: { 
                status: aiStatus, 
                latencyMs: aiLatency,
                provider: embeddingHealth.provider || llamaHealth.provider || "jina",
                embedding: embeddingHealth,
                llm: llamaHealth
            },
            embedding: embeddingHealth,
            localStorage: { status: storageStatus, latencyMs: storageLatency, root: localStorageManager.STORAGE_ROOT },
            storage: { status: storageStatus, latencyMs: storageLatency, root: localStorageManager.STORAGE_ROOT }
        },
        queueSummary: {
            concurrency: queueStats.concurrency,
            activeJobs: queueStats.activeJobs.length,
            workerUtilizationPct: queueStats.workerUtilizationPct !== undefined ? queueStats.workerUtilizationPct : (queueStats.concurrency > 0 ? Math.round((queueStats.activeJobs.length / queueStats.concurrency) * 100) : 0),
            waitingJobs: queueStats.totalQueued,
            completedJobs: queueStats.completedCount,
            failedJobs: queueStats.failedCount,
            totalDocuments: queueStats.totalCount
        }
    };

    cachedHealthSnapshot = report;
    lastHealthCheckTime = now;

    return sendJson(res, 200, "Chunking server runtime health.", report);
};

app.get("/health", handleHealthCheck);
app.get("/api/health", handleHealthCheck);
app.get("/api/documents/queue/health", handleHealthCheck);
app.get("/api/v1/documents/queue/health", handleHealthCheck);

// ==========================================
// 2. Queue Status & Controls
// ==========================================
const handleGetQueue = async (req, res) => {
    const status = await chunkingQueueService.getQueueStatus();
    return sendJson(res, 200, "Queue status retrieved.", status);
};

app.get("/queue", handleGetQueue);
app.get("/queue/status", handleGetQueue);
app.get("/api/documents/queue/status", handleGetQueue);
app.get("/api/v1/documents/queue/status", handleGetQueue);

// Enqueue documents
const handleEnqueue = async (req, res) => {
    const { ids, category, allPending, forceRechunk } = req.body || {};
    const result = await chunkingQueueService.enqueueDocuments({
        ids,
        category,
        allPending: allPending ?? (!ids && !category),
        forceRechunk: Boolean(forceRechunk)
    });
    return sendJson(res, 200, `Enqueued ${result.count} document(s).`, result);
};

app.post("/queue/enqueue", handleEnqueue);
app.post("/api/documents/queue/enqueue", handleEnqueue);
app.post("/api/v1/documents/queue/enqueue", handleEnqueue);

// Pause / Resume / Clear Queue
app.post(["/queue/pause", "/api/documents/queue/pause", "/api/v1/documents/queue/pause"], async (req, res) => {
    const result = chunkingQueueService.pauseQueue();
    return sendJson(res, 200, "Chunking queue paused.", result);
});

app.post(["/queue/resume", "/api/documents/queue/resume", "/api/v1/documents/queue/resume"], async (req, res) => {
    const result = chunkingQueueService.resumeQueue();
    return sendJson(res, 200, "Chunking queue resumed.", result);
});

app.post(["/queue/clear", "/api/documents/queue/clear", "/api/v1/documents/queue/clear"], async (req, res) => {
    const result = await chunkingQueueService.clearQueue();
    return sendJson(res, 200, "Queue cleared.", result);
});

// Retry Controls
app.post(["/queue/retry-all", "/queue/retry-failed", "/api/documents/queue/retry-failed", "/api/v1/documents/queue/retry-failed"], async (req, res) => {
    const result = await chunkingQueueService.retryAllFailed();
    return sendJson(res, 200, "All failed jobs re-enqueued.", result);
});

app.post(["/queue/pause/:documentId", "/api/documents/queue/pause/:documentId", "/api/v1/documents/queue/pause/:documentId"], async (req, res) => {
    const result = await chunkingQueueService.pauseJob(req.params.documentId);
    return sendJson(res, 200, "Document chunking paused.", result);
});

app.post(["/queue/resume/:documentId", "/api/documents/queue/resume/:documentId", "/api/v1/documents/queue/resume/:documentId"], async (req, res) => {
    const result = await chunkingQueueService.resumeJob(req.params.documentId);
    return sendJson(res, 200, "Document chunking resumed.", result);
});

app.post(["/queue/cancel/:documentId", "/api/documents/queue/cancel/:documentId", "/api/v1/documents/queue/cancel/:documentId"], async (req, res) => {
    const result = await chunkingQueueService.cancelJob(req.params.documentId);
    return sendJson(res, 200, "Document chunking cancelled.", result);
});

app.post(["/queue/dismiss/:documentId", "/api/documents/queue/dismiss/:documentId", "/api/v1/documents/queue/dismiss/:documentId"], async (req, res) => {
    const result = await chunkingQueueService.dismissJob(req.params.documentId);
    return sendJson(res, 200, "Document dismissed from failure queue.", result);
});

app.post(["/queue/dismiss-failed", "/queue/dismiss-all", "/api/documents/queue/dismiss-failed", "/api/v1/documents/queue/dismiss-failed"], async (req, res) => {
    const result = await chunkingQueueService.dismissAllFailed();
    return sendJson(res, 200, "All failed documents dismissed.", result);
});

app.post(["/queue/retry/:documentId", "/api/documents/queue/retry/:documentId", "/api/v1/documents/queue/retry/:documentId"], async (req, res) => {
    const result = await chunkingQueueService.retryJob(req.params.documentId);
    return sendJson(res, 200, "Document re-enqueued for chunking.", result);
});

// Worker Pool Controls
app.post(["/worker/start", "/api/documents/worker/start", "/api/v1/documents/worker/start"], async (req, res) => {
    const result = await chunkingQueueService.startWorkerPool();
    return sendJson(res, 200, "Worker pool started.", result);
});

app.post(["/worker/stop", "/api/documents/worker/stop", "/api/v1/documents/worker/stop"], async (req, res) => {
    const result = chunkingQueueService.stopWorkerPool();
    return sendJson(res, 200, "Worker pool stopped.", result);
});

app.post(["/worker/restart", "/api/documents/worker/restart", "/api/v1/documents/worker/restart"], async (req, res) => {
    const result = await chunkingQueueService.restartWorkerPool();
    return sendJson(res, 200, "Worker pool restarted.", result);
});

// Re-Index All
app.post(["/qdrant/reindex", "/queue/reindex", "/queue/reindex-all", "/api/documents/queue/reindex", "/api/v1/documents/queue/reindex"], async (req, res) => {
    const result = await chunkingQueueService.reindexAll();
    return sendJson(res, 200, "Re-indexing initiated for all active documents.", result);
});

// Logs Clear
app.post(["/queue/logs/clear", "/logs/clear", "/api/documents/logs/clear"], async (req, res) => {
    const result = chunkingQueueService.clearLogs();
    return sendJson(res, 200, "Runtime logs cleared.", result);
});

// ==========================================
// 3. SSE Stream Endpoints
// ==========================================

// SSE: Live Queue Progress
const handleQueueStream = async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) res.flushHeaders();
    registerSseClient(res);

    const sendEvent = (event, data) => {
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (_) {}
    };

    // Initial snapshot
    const initialStatus = await chunkingQueueService.getQueueStatus();
    const initialLogs = chunkingQueueService.getLogs(50);
    sendEvent("initial_state", { status: initialStatus, logs: initialLogs });

    const onProgress = (data) => sendEvent("progress", data);
    const onLog = (data) => sendEvent("log", data);
    const onQueueUpdate = (data) => sendEvent("queue_update", data);
    const onWorkerStatus = (data) => sendEvent("worker_status", data);
    const onStorageUpdated = (data) => sendEvent("storage_updated", data);

    chunkingQueueService.queueEvents.on("progress", onProgress);
    chunkingQueueService.queueEvents.on("log", onLog);
    chunkingQueueService.queueEvents.on("queue_update", onQueueUpdate);
    chunkingQueueService.queueEvents.on("worker_status", onWorkerStatus);
    chunkingQueueService.queueEvents.on("storage_updated", onStorageUpdated);

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
        chunkingQueueService.queueEvents.off("storage_updated", onStorageUpdated);
    });
};

app.get("/queue/stream", handleQueueStream);
app.get("/api/documents/queue/stream", handleQueueStream);
app.get("/api/v1/documents/queue/stream", handleQueueStream);

// SSE: Live Runtime Logs Stream
const handleLogsStream = async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (res.flushHeaders) res.flushHeaders();
    registerSseClient(res);

    const sendEvent = (event, data) => {
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (_) {}
    };

    // Initial log buffer snapshot
    const logs = chunkingQueueService.getLogs(100);
    sendEvent("initial_logs", { logs });

    const onLog = (data) => sendEvent("log", data);
    chunkingQueueService.queueEvents.on("log", onLog);

    const heartbeat = setInterval(() => {
        sendEvent("heartbeat", { time: new Date().toISOString() });
    }, 15000);

    req.on("close", () => {
        clearInterval(heartbeat);
        chunkingQueueService.queueEvents.off("log", onLog);
    });
};

app.get("/logs/stream", handleLogsStream);
app.get("/api/documents/logs/stream", handleLogsStream);
app.get("/api/v1/documents/logs/stream", handleLogsStream);

// REST Logs Retrieval & Clear
app.get(["/queue/logs", "/logs", "/api/documents/queue/logs", "/api/v1/documents/queue/logs"], (req, res) => {
    const limit = parseInt(req.query.limit || "200", 10);
    const logs = chunkingQueueService.getLogs(limit);
    return sendJson(res, 200, "Runtime logs retrieved.", { logs });
});

app.post(["/queue/logs/clear", "/logs/clear", "/api/documents/queue/logs/clear", "/api/v1/documents/queue/logs/clear"], (req, res) => {
    const result = chunkingQueueService.clearLogs();
    return sendJson(res, 200, "Runtime logs cleared.", result);
});

// ==========================================
// 4. Local Storage Explorer & Sync
// ==========================================
const handleStorageTree = async (req, res) => {
    localStorageManager.ensureStorageRoot();
    const exploreRoot = localStorageManager.FILE_EXPLORER_DIR;
    const stats = localStorageManager.getLocalStorageStats(true);

    const docMap = new Map();
    if (mongoose.connection?.readyState === 1) {
        try {
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
        } catch (_) {}
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
            if (localStorageManager.isIgnoredDirectory(entry.name)) continue;

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
                    embeddingStatus: docRecord?.embeddingStatus || "unindexed",
                    indexedChunks: docRecord?.chunkStats?.indexedChunks || 0,
                    totalChunks: docRecord?.chunkStats?.totalChunks || 0,
                    category: docRecord?.category || relPath.split("/")[0] || "general"
                });
            }
        }

        return items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "folder" ? -1 : 1;
        });
    };

    const tree = buildTree(exploreRoot);
    return sendJson(res, 200, "Storage tree retrieved.", {
        root: exploreRoot,
        displayRoot: "edumate/storage/file_explorer/",
        stats,
        tree
    });
};

app.get("/storage/tree", handleStorageTree);
app.get("/api/documents/storage/tree", handleStorageTree);
app.get("/api/v1/documents/storage/tree", handleStorageTree);

// Storage Scan & Sync
const handleScanSync = async (req, res) => {
    if (mongoose.connection?.readyState !== 1) {
        return sendJson(res, 200, "Database is offline. Storage folders and files verified.", {
            totalDiscovered: 0,
            ignoredFilesCount: 0,
            registeredCount: 0,
            documentIds: []
        });
    }
    const crypto = require("crypto");
    localStorageManager.ensureStorageRoot();
    const scanDir = localStorageManager.FILE_EXPLORER_DIR;
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");

    // Purge corrupted legacy records
    await cleanupCorruptedDocuments();

    // Scan inside FILE_EXPLORER_DIR directly
    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(scanDir, scanDir);

    const MIME_MAP = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff"
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
                    uploadedFrom: "chunking_server_sync",
                    localRelativePath: file.relPath,
                    syncedAt: new Date().toISOString()
                }
            });
            registeredCount++;
        }

        documentIds.push(doc._id);
    }

    chunkingQueueService.emitLog("SUCCESS", `Filesystem sync complete: ${supportedFiles.length} valid documents (${registeredCount} new, ${ignoredFiles.length} cache files ignored).`);
    return sendJson(res, 200, "Filesystem synchronized successfully.", {
        totalDiscovered: supportedFiles.length,
        ignoredFilesCount: ignoredFiles.length,
        registeredCount,
        documentIds
    });
};

app.post("/storage/scan-sync", handleScanSync);
app.post("/api/documents/storage/scan-sync", handleScanSync);
app.post("/api/v1/documents/storage/scan-sync", handleScanSync);

// ==========================================
// 5. Qdrant Management & Chunk Inspector
// ==========================================
const handleQdrantStatus = async (req, res) => {
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
    } catch (_) {
        isConnected = false;
    }

    let indexedDocsCount = 0;
    let pendingDocsCount = 0;
    let failedDocsCount = 0;
    let partialDocsCount = 0;
    if (mongoose.connection?.readyState === 1) {
        try {
            [indexedDocsCount, pendingDocsCount, failedDocsCount, partialDocsCount] = await Promise.all([
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["completed", "indexed"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["pending", "queued", "processing"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: "failed" }),
                Document.countDocuments({ status: "active", embeddingStatus: "partial" })
            ]);
        } catch (_) {}
    }

    const chunkStats = localChunkManager.getAllChunkStats();

    return sendJson(res, 200, "Qdrant vector status.", {
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
};

app.get("/qdrant/status", handleQdrantStatus);
app.get("/api/documents/qdrant/status", handleQdrantStatus);
app.get("/api/v1/documents/qdrant/status", handleQdrantStatus);

// Qdrant Vector Verification
app.post(["/qdrant/verify", "/api/documents/qdrant/verify", "/api/v1/documents/qdrant/verify"], async (req, res) => {
    const report = await integrityService.auditKnowledgeBase();
    return sendJson(res, 200, "Vector verification completed.", report);
});

// Delete Qdrant Vectors & Chunks
app.delete(["/qdrant/vectors/:documentId", "/api/documents/qdrant/vectors/:documentId", "/api/v1/documents/qdrant/vectors/:documentId"], async (req, res) => {
    const { documentId } = req.params;
    try {
        await qdrantClient.delete(qdrantCollection, {
            filter: {
                must: [{ key: "metadata.documentId", match: { value: String(documentId) } }]
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

    return sendJson(res, 200, "Vectors and chunks purged.", { documentId });
});

// Chunks JSON & Embeddings preview
app.get(["/chunks/:documentId", "/api/documents/:documentId/chunks", "/api/v1/documents/:documentId/chunks"], async (req, res) => {
    const result = await integrityService.getDocumentChunks(req.params.documentId);
    return sendJson(res, 200, "Document chunks retrieved.", result);
});

// Analytics Overview
app.get(["/chunking/analytics", "/api/documents/chunking/analytics", "/api/v1/documents/chunking/analytics"], async (req, res) => {
    let mongoTotalDocs = 0;
    let mongoIndexedDocs = 0;
    let queuedDocs = 0;
    let processingDocs = 0;
    let failedDocsCount = 0;
    let partialDocs = 0;
    if (mongoose.connection?.readyState === 1) {
        try {
            [mongoTotalDocs, mongoIndexedDocs, queuedDocs, processingDocs, failedDocsCount, partialDocs] = await Promise.all([
                Document.countDocuments({ status: "active" }),
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["completed", "indexed", "Indexed", "Completed"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["queued", "Queued"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["processing", "Processing"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: { $in: ["failed", "Failed", "cancelled", "Cancelled"] } }),
                Document.countDocuments({ status: "active", embeddingStatus: "partial" })
            ]);
        } catch (_) {}
    }
    
    const chunkStats = localChunkManager.getAllChunkStats();
    const storageStats = localStorageManager.getLocalStorageStats(true);

    // Compute physical documents present in storage and their indexed status
    const physicalDocCount = storageStats.supportedDocuments || 0;
    const { supportedFiles } = localStorageManager.scanKnowledgeDocuments();
    
    let physicalIndexedCount = 0;
    if (mongoose.connection?.readyState === 1) {
        try {
            for (const f of supportedFiles) {
                const doc = await Document.findOne({
                    $or: [
                        { storagePath: f.relPath },
                        { storagePath: `file_explorer/${f.relPath}` },
                        { "metadata.localRelativePath": f.relPath },
                        { "metadata.localRelativePath": `file_explorer/${f.relPath}` },
                        { originalName: f.fileName }
                    ],
                    status: "active",
                    embeddingStatus: { $in: ["completed", "indexed", "Indexed", "Completed"] }
                }).select("_id").lean();
                if (doc) physicalIndexedCount++;
            }
        } catch (_) {}
    }

    let failedDocsList = [];
    if (mongoose.connection?.readyState === 1) {
        try {
            failedDocsList = await Document.find({
                status: "active",
                embeddingStatus: { $in: ["failed", "Failed", "cancelled", "Cancelled"] }
            }).select("originalName failureInfo category updatedAt").limit(20).lean();
        } catch (_) {}
    }

    let categoryStats = [];
    if (mongoose.connection?.readyState === 1) {
        try {
            categoryStats = await Document.aggregate([
                { $match: { status: "active" } },
                { $group: { _id: "$category", count: { $sum: 1 }, totalChunks: { $sum: "$chunkStats.totalChunks" } } },
                { $sort: { count: -1 } }
            ]);
        } catch (_) {}
    }

    const totalStorageSizeBytes = storageStats.used || 0;

    return sendJson(res, 200, "Chunking analytics retrieved.", {
        // Physical local storage metrics
        storageDocuments: physicalDocCount,
        storageFolders: storageStats.folders || 0,
        storageSizeBytes: totalStorageSizeBytes,
        storageSizeFormatted: storageStats.usedFormatted,
        totalChunks: chunkStats.totalChunks,
        totalChunkFiles: chunkStats.totalFiles,
        totalChunkSizeBytes: chunkStats.totalBytes,
        indexedDocuments: physicalIndexedCount,
        
        // Historical database metrics
        totalDocuments: physicalDocCount,
        mongoTotalDocuments: mongoTotalDocs,
        mongoIndexedDocuments: mongoIndexedDocs,
        mongoFailedDocuments: failedDocsCount,
        
        queuedDocuments: queuedDocs,
        processingDocuments: processingDocs,
        failedDocuments: failedDocsCount,
        partialDocuments: partialDocs,
        failedDocs: failedDocsList,
        totalStorageSizeBytes,
        storageDetails: {
            files: storageStats.files,
            folders: storageStats.folders,
            supportedDocuments: storageStats.supportedDocuments,
            ignoredFiles: storageStats.ignoredFiles,
            usedBytes: storageStats.used,
            usedFormatted: storageStats.usedFormatted,
            totalFormatted: storageStats.usedFormatted
        },
        categoryDistribution: categoryStats
    });
});

// ==========================================
// 6. Direct Document Upload (Single, Multi & Folder)
// ==========================================
const handleDocumentUpload = async (req, res) => {
    try {
        const files = req.files && Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: "No document files uploaded." });
        }

        const baseCategory = String(req.body.category || req.body.folderPath || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const autoChunk = req.body.autoChunk !== "false" && req.body.autoChunk !== false;

        let relativePathsMap = {};
        if (req.body.relPaths) {
            try {
                relativePathsMap = typeof req.body.relPaths === "string" ? JSON.parse(req.body.relPaths) : req.body.relPaths;
            } catch (_) {}
        }

        let systemAdminId = new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");
        if (mongoose.connection?.readyState === 1) {
            try {
                const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
                if (adminUser?._id) systemAdminId = adminUser._id;
            } catch (_) {}
        }
        const crypto = require("crypto");

        const MIME_MAP = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc": "application/msword",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".ppt": "application/vnd.ms-powerpoint",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".ods": "application/vnd.oasis.opendocument.spreadsheet",
            ".csv": "text/csv",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".markdown": "text/markdown",
            ".html": "text/html",
            ".htm": "text/html",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
            ".tif": "image/tiff"
        };

        const createdDocs = [];
        const enqueuedIds = [];

        for (const file of files) {
            // Determine relative path (from relativePathsMap or fallback to original name)
            let itemRelPath = relativePathsMap[file.originalname] || file.originalname;
            // Sanitize relative path: remove directory traversal & invalid characters
            itemRelPath = itemRelPath.replace(/\\/g, "/").replace(/^[/\\]+/, "").replace(/\.\./g, "").replace(/\/+/g, "/");

            let finalRelPath = itemRelPath;
            if (baseCategory && baseCategory !== "storage" && baseCategory !== "root") {
                if (itemRelPath.toLowerCase().startsWith(baseCategory.toLowerCase() + "/")) {
                    finalRelPath = itemRelPath;
                } else {
                    finalRelPath = `${baseCategory}/${itemRelPath}`;
                }
            }

            finalRelPath = finalRelPath.replace(/\\/g, "/").replace(/^\/+/, "");
            const category = finalRelPath.includes("/") ? finalRelPath.split("/")[0].toLowerCase() : (baseCategory || "general").toLowerCase();

            // Destination path on disk inside FILE_EXPLORER_DIR
            localStorageManager.ensureStorageRoot();
            const destPath = path.join(localStorageManager.FILE_EXPLORER_DIR, finalRelPath);
            const parentDir = path.dirname(destPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            // Move from staging upload dir to destination safely (robust against Windows file locking)
            if (fs.existsSync(destPath)) {
                try { fs.unlinkSync(destPath); } catch (_) {}
            }
            try {
                fs.renameSync(file.path, destPath);
            } catch (_) {
                fs.copyFileSync(file.path, destPath);
                try { fs.unlinkSync(file.path); } catch (_) {}
            }

            // Calculate sha256 checksum
            let checksum = "local-checksum";
            try {
                const buf = fs.readFileSync(destPath);
                checksum = crypto.createHash("sha256").update(buf).digest("hex");
            } catch (_) {}

            const ext = path.extname(file.originalname).toLowerCase();
            const mimeType = MIME_MAP[ext] || file.mimetype || "application/octet-stream";

            let doc = null;
            if (mongoose.connection?.readyState === 1) {
                try {
                    doc = await Document.findOne({
                        $or: [{ storagePath: finalRelPath }, { "metadata.localRelativePath": finalRelPath }],
                        status: { $ne: "deleted" }
                    });

                    if (!doc) {
                        doc = await Document.create({
                            originalName: path.basename(itemRelPath),
                            storagePath: finalRelPath,
                            storedName: path.basename(finalRelPath),
                            fileSize: file.size,
                            mimeType,
                            checksum,
                            createdBy: systemAdminId,
                            category,
                            department: req.body.department || "",
                            status: "active",
                            embeddingStatus: autoChunk ? "queued" : "pending",
                            progress: 0,
                            currentStage: autoChunk ? "Uploaded and enqueued for chunking" : "Uploaded to local storage",
                            metadata: {
                                title: path.basename(itemRelPath),
                                institution: req.body.institution || "",
                                department: req.body.department || "",
                                version: "1.0",
                                notes: "",
                                uploadedFrom: "chunking_server_upload",
                                localRelativePath: finalRelPath,
                                folderPath: path.dirname(finalRelPath) === "." ? "" : path.dirname(finalRelPath)
                            }
                        });
                    } else {
                        doc.fileSize = file.size;
                        doc.checksum = checksum;
                        doc.originalName = path.basename(itemRelPath);
                        doc.storedName = path.basename(finalRelPath);
                        doc.category = category;
                        doc.embeddingStatus = autoChunk ? "queued" : "pending";
                        doc.progress = 0;
                        doc.currentStage = autoChunk ? "Re-uploaded and enqueued for chunking" : "Updated in local storage";
                        if (doc.metadata) {
                            doc.metadata.localRelativePath = finalRelPath;
                            doc.metadata.folderPath = path.dirname(finalRelPath) === "." ? "" : path.dirname(finalRelPath);
                        }
                        await doc.save();
                    }
                } catch (dbErr) {
                    chunkingQueueService.emitLog("WARN", `DB save skipped for ${file.originalname}: ${dbErr.message}`);
                }
            }

            if (!doc) {
                doc = {
                    _id: new mongoose.Types.ObjectId(),
                    originalName: path.basename(itemRelPath),
                    storagePath: finalRelPath,
                    storedName: path.basename(finalRelPath),
                    fileSize: file.size,
                    mimeType,
                    checksum,
                    category,
                    status: "active",
                    embeddingStatus: autoChunk ? "queued" : "pending",
                    progress: 0,
                    currentStage: autoChunk ? "Uploaded to local storage and queued" : "Uploaded to local storage"
                };
            }

            createdDocs.push(doc);
            if (autoChunk && doc._id) {
                enqueuedIds.push(doc._id);
            }
        }

        if (autoChunk && enqueuedIds.length > 0) {
            await chunkingQueueService.enqueueDocuments({ ids: enqueuedIds });
            chunkingQueueService.triggerWorkerPool();
        }

        chunkingQueueService.emitLog("SUCCESS", `Uploaded ${createdDocs.length} document(s) to [${baseCategory || "storage"}]. Enqueued.`);
        return sendJson(res, 201, `Successfully uploaded ${createdDocs.length} document(s).`, {
            filesCount: createdDocs.length,
            documents: createdDocs,
            queuedIds: enqueuedIds
        });
    } catch (err) {
        chunkingQueueService.emitLog("ERROR", `Upload handler error: ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
};

app.post(["/upload", "/studio/upload", "/documents/upload", "/api/documents", "/api/v1/documents", "/storage/upload", "/api/documents/storage/upload"], safeUploadMiddleware, handleDocumentUpload);

// Storage File Download Endpoint
app.get(["/storage/file/download", "/api/documents/storage/file/download"], async (req, res) => {
    try {
        const filePath = String(req.query.path || "").trim();
        if (!filePath) {
            return res.status(400).json({ success: false, message: "File path required." });
        }
        const safePath = localStorageManager.resolveSafePath(filePath);
        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ success: false, message: `File not found: ${filePath}` });
        }
        return res.download(safePath, path.basename(safePath));
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Document List
app.get(["/documents", "/api/documents", "/api/v1/documents"], async (req, res) => {
    const docs = await Document.find({ status: { $ne: "deleted" } })
        .sort({ updatedAt: -1 })
        .limit(100);
    return sendJson(res, 200, "Documents retrieved.", { documents: docs, total: docs.length });
});

// Queue History (Mission 15.2)
app.get(["/queue/history", "/api/documents/queue/history", "/api/v1/documents/queue/history"], async (req, res) => {
    const history = await Document.find({
        status: "active",
        embeddingStatus: { $in: ["completed", "indexed", "failed"] }
    }).sort({ updatedAt: -1 }).limit(50).lean();
    return sendJson(res, 200, "Queue history retrieved.", { history });
});

// Storage Categories & Stats (Mission 15.2)
app.get(["/storage/stats", "/api/documents/storage/stats", "/api/v1/documents/storage/stats"], async (req, res) => {
    const stats = localStorageManager.getLocalStorageStats(true);
    return sendJson(res, 200, "Storage statistics retrieved.", stats);
});

app.get(["/storage/categories", "/api/documents/storage/categories", "/api/v1/documents/storage/categories"], async (req, res) => {
    const categories = localStorageManager.getStorageCategories();
    return sendJson(res, 200, "Storage categories retrieved.", { categories });
});

// Worker Reset (Mission 15.2)
app.post(["/worker/reset", "/api/documents/worker/reset", "/api/v1/documents/worker/reset"], async (req, res) => {
    const result = await chunkingQueueService.restartWorkerPool();
    return sendJson(res, 200, "Worker pool reset and restarted.", result);
});

// Qdrant Reindex & Vector Inspector (Mission 15.2)
app.post(["/qdrant/reindex", "/api/documents/qdrant/reindex", "/api/v1/documents/qdrant/reindex"], async (req, res) => {
    const result = await chunkingQueueService.enqueueDocuments({ allPending: true, forceRechunk: true });
    return sendJson(res, 200, "Reindexing enqueued for all documents.", result);
});

app.get(["/qdrant/vectors/:documentId", "/api/documents/qdrant/vectors/:documentId", "/api/v1/documents/qdrant/vectors/:documentId"], async (req, res) => {
    const { documentId } = req.params;
    try {
        const points = await qdrantClient.scroll(qdrantCollection, {
            filter: { must: [{ key: "metadata.documentId", match: { value: String(documentId) } }] },
            limit: 50,
            with_payload: true,
            with_vector: false
        });
        return sendJson(res, 200, "Vector points retrieved.", { points: points.points || [] });
    } catch (err) {
        return sendJson(res, 500, `Failed to retrieve vector points: ${err.message}`, { points: [] });
    }
});

// Chunks by Page & Chunks Preview (Mission 15.2)
app.get(["/chunks/:documentId/page/:page", "/api/documents/:documentId/chunks/page/:page"], async (req, res) => {
    const { documentId, page } = req.params;
    const pageNum = parseInt(page, 10) || 1;
    const result = await integrityService.getDocumentChunks(documentId);
    const filtered = (result.chunks || []).filter(c => (c.metadata?.pageNumber || c.pageNumber) === pageNum);
    return sendJson(res, 200, `Chunks for page ${pageNum} retrieved.`, { chunks: filtered, page: pageNum, total: filtered.length });
});

app.get(["/chunks/:documentId/preview", "/api/documents/:documentId/chunks/preview"], async (req, res) => {
    const { documentId } = req.params;
    const result = await integrityService.getDocumentChunks(documentId);
    const preview = (result.chunks || []).slice(0, 5);
    return sendJson(res, 200, "Chunk preview retrieved.", { preview, totalChunks: result.chunks?.length || 0 });
});

// ==========================================
// Storage Explorer Operations (Mission 15.3)
// ==========================================

// 1. File Preview Content Endpoint
app.get(["/storage/file/preview", "/api/documents/storage/file/preview"], async (req, res) => {
    try {
        const filePath = String(req.query.path || "").trim();
        if (!filePath) {
            return res.status(400).json({ success: false, message: "File path query parameter required." });
        }

        const safePath = localStorageManager.resolveSafePath(filePath);
        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ success: false, message: `File not found: ${filePath}` });
        }

        const stat = fs.statSync(safePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);

        // Find database record if indexed
        const docRecord = await Document.findOne({
            $or: [{ storagePath: filePath }, { "metadata.localRelativePath": filePath }],
            status: { $ne: "deleted" }
        }).lean();

        let textPreview = "";
        let isText = false;
        let isPdf = ext === ".pdf";
        let isImage = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"].includes(ext);

        if ([".txt", ".md", ".markdown", ".json", ".log", ".csv"].includes(ext)) {
            isText = true;
            try {
                const raw = fs.readFileSync(safePath, "utf8");
                textPreview = raw.slice(0, 30000); // Up to 30KB
            } catch (_) {}
        } else if (isPdf) {
            try {
                const pdfParse = require("pdf-parse");
                const buffer = fs.readFileSync(safePath);
                const pdfData = await pdfParse(buffer, { max: 5 });
                textPreview = pdfData.text ? pdfData.text.slice(0, 10000) : "";
            } catch (_) {}
        } else if (isImage && docRecord) {
            try {
                const chunkData = await integrityService.getDocumentChunks(docRecord._id);
                if (chunkData && Array.isArray(chunkData.chunks) && chunkData.chunks.length > 0) {
                    textPreview = chunkData.chunks.map(c => c.content).filter(Boolean).join("\n\n");
                }
            } catch (_) {}
        }

        return sendJson(res, 200, "File preview retrieved.", {
            fileName,
            filePath,
            extension: ext,
            size: stat.size,
            mtime: stat.mtime,
            isText,
            isPdf,
            isImage,
            textPreview,
            document: docRecord,
            indexedChunks: docRecord?.chunkStats?.indexedChunks || 0,
            totalChunks: docRecord?.chunkStats?.totalChunks || 0,
            embeddingStatus: docRecord?.embeddingStatus || "unindexed"
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Create Storage Folder
app.post(["/storage/folder", "/api/documents/storage/folder"], async (req, res) => {
    try {
        const folderPath = String(req.body.folderPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (!folderPath) {
            return res.status(400).json({ success: false, message: "Folder path is required." });
        }

        const fullPath = await localStorageManager.createFolder(folderPath);
        chunkingQueueService.emitLog("INFO", `Created folder: ${folderPath}`);
        return sendJson(res, 201, `Folder created: ${folderPath}`, { folderPath, fullPath });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Delete Storage Folder (Cascade)
app.delete(["/storage/folder", "/api/documents/storage/folder"], async (req, res) => {
    try {
        const folderPath = String(req.body.folderPath || req.query.folderPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (!folderPath) {
            return res.status(400).json({ success: false, message: "Folder path is required." });
        }

        // 1. Delete on disk
        await localStorageManager.deleteFolder(folderPath);

        // 2. Find associated documents
        const regex = new RegExp(`^${folderPath}/`, "i");
        const matchingDocs = await Document.find({
            $or: [{ storagePath: regex }, { "metadata.localRelativePath": regex }],
            status: { $ne: "deleted" }
        });

        for (const doc of matchingDocs) {
            try {
                await qdrantClient.delete(qdrantCollection, {
                    filter: { must: [{ key: "metadata.documentId", match: { value: String(doc._id) } }] }
                });
            } catch (_) {}
            await localChunkManager.deleteDocumentChunks(doc._id);
            doc.status = "deleted";
            await doc.save();
        }

        chunkingQueueService.emitLog("WARN", `Deleted folder: ${folderPath} (${matchingDocs.length} documents purged).`);
        return sendJson(res, 200, `Folder deleted: ${folderPath}`, { folderPath, deletedDocsCount: matchingDocs.length });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Delete Storage File
app.delete(["/storage/file", "/api/documents/storage/file"], async (req, res) => {
    try {
        const filePath = String(req.body.filePath || req.query.filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
        if (!filePath) {
            return res.status(400).json({ success: false, message: "File path is required." });
        }

        // Delete on disk
        await localStorageManager.deleteFile(filePath);

        // Delete in MongoDB & Qdrant
        const doc = await Document.findOne({
            $or: [{ storagePath: filePath }, { "metadata.localRelativePath": filePath }],
            status: { $ne: "deleted" }
        });

        if (doc) {
            try {
                await qdrantClient.delete(qdrantCollection, {
                    filter: { must: [{ key: "metadata.documentId", match: { value: String(doc._id) } }] }
                });
            } catch (_) {}
            await localChunkManager.deleteDocumentChunks(doc._id);
            doc.status = "deleted";
            await doc.save();
        }

        chunkingQueueService.emitLog("WARN", `Deleted file: ${filePath}`);
        return sendJson(res, 200, `File deleted: ${filePath}`, { filePath, documentId: doc?._id });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Rename Storage File or Folder
app.post(["/storage/rename", "/api/documents/storage/rename"], async (req, res) => {
    try {
        const oldPath = String(req.body.oldPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
        const newPath = String(req.body.newPath || "").replace(/\\/g, "/").replace(/^\/+/, "");

        if (!oldPath || !newPath) {
            return res.status(400).json({ success: false, message: "Both oldPath and newPath are required." });
        }

        await localStorageManager.moveFile(oldPath, newPath);

        // Update database references
        const doc = await Document.findOne({
            $or: [{ storagePath: oldPath }, { "metadata.localRelativePath": oldPath }],
            status: { $ne: "deleted" }
        });

        if (doc) {
            doc.storagePath = newPath;
            doc.storedName = path.basename(newPath);
            doc.originalName = path.basename(newPath);
            if (doc.metadata) {
                doc.metadata.localRelativePath = newPath;
            }
            await doc.save();
        }

        chunkingQueueService.emitLog("INFO", `Renamed: ${oldPath} → ${newPath}`);
        return sendJson(res, 200, `Renamed ${oldPath} to ${newPath}`, { oldPath, newPath });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Enqueue Specific Folder for Chunking / Reindexing
app.post(["/storage/chunk/folder", "/api/documents/storage/chunk/folder"], async (req, res) => {
    try {
        const folderPath = String(req.body.folderPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const force = !!req.body.force;

        let query = { status: { $ne: "deleted" } };
        if (folderPath && folderPath !== "all" && folderPath !== "storage") {
            const regex = new RegExp(`^${folderPath}(/|$)`, "i");
            query.$or = [{ storagePath: regex }, { "metadata.localRelativePath": regex }, { category: folderPath.toLowerCase() }];
        }

        const docs = await Document.find(query).select("_id originalName");
        const docIds = docs.map(d => d._id);

        if (docIds.length === 0) {
            return sendJson(res, 200, `No documents found under folder: ${folderPath || "storage"}`, { enqueuedCount: 0 });
        }

        const result = await chunkingQueueService.enqueueDocuments({
            ids: docIds,
            forceRechunk: force
        });

        chunkingQueueService.emitLog("INFO", `Enqueued folder [${folderPath || "storage"}] (${docIds.length} docs, force=${force}).`);
        return sendJson(res, 200, `Enqueued ${docIds.length} documents from folder: ${folderPath || "storage"}`, {
            folderPath,
            enqueuedCount: docIds.length,
            result
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});


// Serve static Chunking Studio frontend (Mission 15.3)
const uiPath = path.join(__dirname, "chunking-ui");
if (fs.existsSync(uiPath)) {
    app.use(express.static(uiPath));
}

// ==========================================
// 7. Microservice Root Endpoint & Standalone Browser Chunking Studio (Mission 15.3)
// ==========================================
app.get(["/studio", "/studio/", "/dashboard"], async (req, res) => {
    if (req.query.format === "json") {
        return sendJson(res, 200, "EduMate Chunking Server Microservice (Terminal 2)", {
            service: "edumate-chunking-server",
            type: "dedicated-service",
            status: "online",
            port: CHUNKING_PORT,
            ui: `http://localhost:${CHUNKING_PORT}/studio/`,
            endpoints: {
                health: `http://localhost:${CHUNKING_PORT}/health`,
                queue: `http://localhost:${CHUNKING_PORT}/queue`,
                queueStream: `http://localhost:${CHUNKING_PORT}/queue/stream`,
                logsStream: `http://localhost:${CHUNKING_PORT}/logs/stream`,
                storageTree: `http://localhost:${CHUNKING_PORT}/storage/tree`,
                storageSync: `http://localhost:${CHUNKING_PORT}/storage/scan-sync`,
                qdrantStatus: `http://localhost:${CHUNKING_PORT}/qdrant/status`,
                qdrantVerify: `http://localhost:${CHUNKING_PORT}/qdrant/verify`
            }
        });
    }

    const indexPath = path.join(uiPath, "index.html");
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    return res.status(200).send("EduMate Chunking Server is online.");
});

let storageWatcherInstance = null;
let fsWatchDebounceTimer = null;

function setupStorageWatcher() {
    const storageRoot = localStorageManager.ensureStorageRoot();
    try {
        storageWatcherInstance = fs.watch(storageRoot, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            const parts = filename.split(/[\\/]/);
            const basename = path.basename(filename);
            if (
                parts.some(p => localStorageManager.isIgnoredDirectory(p) || localStorageManager.isIgnoredFile(p)) ||
                localStorageManager.isIgnoredDirectory(basename) ||
                localStorageManager.isIgnoredFile(basename)
            ) {
                return;
            }

            clearTimeout(fsWatchDebounceTimer);
            fsWatchDebounceTimer = setTimeout(async () => {
                try {
                    console.log(`[StorageWatcher] Change detected (${eventType}: ${filename}). Auto-syncing...`);
                    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(storageRoot);

                    chunkingQueueService.emitLog("INFO", `Filesystem modified: "${filename}" (${eventType}). Auto-synced storage tree (${supportedFiles.length} docs).`);
                    chunkingQueueService.queueEvents.emit("storage_updated", {
                        eventType,
                        filename,
                        timestamp: new Date().toISOString(),
                        supportedCount: supportedFiles.length,
                        ignoredCount: ignoredFiles.length
                    });
                } catch (watchErr) {
                    console.error("[StorageWatcher] Auto-sync failed:", watchErr.message);
                }
            }, 500);
        });
        console.log(`[StorageWatcher] ✓ Live recursive filesystem watcher active on: ${storageRoot}`);
    } catch (err) {
        console.warn(`[StorageWatcher] ⚠️ Could not initialize recursive fs.watch on ${storageRoot}: ${err.message}`);
    }
}

// ==========================================
// 8. Server Startup & Initialization Routine
// ==========================================
let serverInstance = null;

async function startChunkingServer() {
    console.log("================================================================");
    console.log("    ⚡ EDUMATE DEDICATED CHUNKING SERVER (MISSION 15.3)        ");
    console.log("================================================================");
    console.log(`[Init] Process PID: ${process.pid} | Node: ${process.version}`);
    console.log(`[Init] Port: ${CHUNKING_PORT}`);
    console.log(`[Storage] Knowledge Root: ${localStorageManager.STORAGE_ROOT}`);

    // 1. Start HTTP Server immediately
    serverInstance = http.createServer(app);
    serverInstance.listen(CHUNKING_PORT, () => {
        console.log("\n================================================================");
        console.log(` 🚀 Chunking API Server:       http://localhost:${CHUNKING_PORT}`);
        console.log(` 📊 Health Check:              http://localhost:${CHUNKING_PORT}/health`);
        console.log(` 📑 Queue Status:              http://localhost:${CHUNKING_PORT}/queue`);
        console.log(` 📡 Queue Progress SSE:        http://localhost:${CHUNKING_PORT}/queue/stream`);
        console.log(` 📜 Runtime Logs SSE:          http://localhost:${CHUNKING_PORT}/logs/stream`);
        console.log(` 🎨 Browser Chunking Studio:   http://localhost:${CHUNKING_PORT}/`);
        console.log("================================================================\n");
    });

    // 2. Ensure Local Storage & Setup Watcher
    const storageRoot = localStorageManager.ensureStorageRoot();
    console.log(`[Storage] ✓ Local storage initialized at: ${storageRoot}`);
    setupStorageWatcher();

    // 3. Connect MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/edumate";
    if (mongoUri && mongoUri.startsWith("mongodb+srv://")) {
        try {
            require("dns").setServers(["1.1.1.1", "8.8.8.8"]);
        } catch (_) {}
    }
    console.log("[MongoDB] Connecting to database...");
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log(`[MongoDB] ✓ Connected successfully to ${mongoose.connection.name}.`);
    } catch (mErr) {
        console.error(`[MongoDB] ⚠️ Connection error: ${mErr.message}`);
    }

    // Clean corrupted legacy records
    await cleanupCorruptedDocuments();

    // 4. Verify Qdrant Vector DB
    console.log(`[Qdrant] Verifying collection '${qdrantCollection}'...`);
    try {
        if (typeof ensureCollection === "function") {
            await ensureCollection();
        }
        const info = await qdrantClient.getCollection(qdrantCollection);
        const vectorsCount = info.vectors_count || info.points_count || 0;
        console.log(`[Qdrant] ✓ Connected. Ready with ${vectorsCount} indexed vectors.`);
    } catch (qErr) {
        console.warn(`[Qdrant] ⚠️ Warning: Qdrant check returned: ${qErr.message}`);
    }

    // 5. Scan & Sync Local Storage Documents
    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(storageRoot);
    console.log(`[Storage] Found ${supportedFiles.length} valid documents (Ignored ${ignoredFiles.length} cache files).`);

    // 6. Recover Queue & Check Persisted Worker State
    await chunkingQueueService.recoverQueueOnStartup();
    const currentWorkerState = chunkingQueueService.getWorkerStatus();
    if (currentWorkerState === "RUNNING") {
        await chunkingQueueService.startWorkerPool();
        console.log("[Worker] ✓ Queue worker pool initialized and active.");
    } else {
        console.log(`[Worker] 🔒 Worker pool is persisted as ${currentWorkerState}. Workers remain idle until explicitly started by user.`);
    }
}

// ==========================================
// 9. Graceful Shutdown Routine
// ==========================================
let isShuttingDown = false;

async function handleShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[ChunkingServer] Received ${signal}. Initiating graceful shutdown...`);

    // 1. Pause worker pool in-memory without overwriting persistent RUNNING state
    try {
        chunkingQueueService.pauseQueue();
        console.log("[ChunkingServer] In-memory workers stopped.");
    } catch (_) {}

    // 2. Terminate active SSE clients
    for (const client of activeSseConnections) {
        try {
            client.write(`event: shutdown\ndata: {"message": "Server shutting down"}\n\n`);
            client.end();
        } catch (_) {}
    }
    activeSseConnections.clear();
    console.log("[ChunkingServer] Active SSE connections closed.");

    // 3. Close HTTP Server
    if (serverInstance) {
        serverInstance.close(() => {
            console.log("[ChunkingServer] HTTP server closed.");
        });
    }

    // 4. Close MongoDB connection
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("[ChunkingServer] MongoDB connection closed.");
        }
    } catch (_) {}

    console.log("[ChunkingServer] Graceful shutdown complete. Goodbye!\n");
    process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGHUP", () => handleShutdown("SIGHUP"));

// Handle unhandled errors
process.on("uncaughtException", (err) => {
    console.error("[ChunkingServer] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("[ChunkingServer] Unhandled rejection:", reason);
});

// Launch server only when invoked directly as standalone process
if (require.main === module) {
    startChunkingServer().catch((err) => {
        console.error("[ChunkingServer] Fatal error on startup:", err);
        process.exit(1);
    });
}

module.exports = app;
