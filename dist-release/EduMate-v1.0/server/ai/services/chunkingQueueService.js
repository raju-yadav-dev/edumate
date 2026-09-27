const EventEmitter = require("events");
const Document = require("../../models/Document");
const loggerService = require("../../services/loggerService");

const queueEvents = new EventEmitter();
queueEvents.setMaxListeners(100);

const CONCURRENCY = Math.max(1, parseInt(process.env.CHUNKING_QUEUE_CONCURRENCY || "2", 10));

let isQueuePaused = false;
const activeWorkers = new Map(); // workerId -> { documentId, originalName, stage, progress, startTime, timer }
const pausedDocIds = new Set();
const cancelledDocIds = new Set();

// In-Memory Ring Buffer for Real-Time Runtime Logs (up to 500 entries)
const MAX_LOG_ENTRIES = 500;
const logBuffer = [];

/**
 * Emit and record a structured log entry in memory and broadcast over SSE.
 * Levels: INFO, SUCCESS, WARNING, ERROR, RETRY
 */
const emitLog = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp,
        level: (level || "INFO").toUpperCase(),
        message,
        stage: meta.stage || "",
        documentId: meta.documentId || "",
        fileName: meta.fileName || "",
        workerId: meta.workerId || "",
        details: meta.details || null
    };

    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_ENTRIES) {
        logBuffer.shift();
    }

    try {
        loggerService.logChunking(entry.level.toLowerCase(), message, meta);
    } catch (_) {}

    queueEvents.emit("log", entry);
    return entry;
};

/**
 * Emit real-time progress update event for a document
 */
const emitProgress = (payload) => {
    queueEvents.emit("progress", payload);
};

const getLogs = (limit = 200) => {
    return logBuffer.slice(-Math.min(limit, MAX_LOG_ENTRIES));
};

const clearLogs = () => {
    logBuffer.length = 0;
    emitLog("INFO", "Runtime log buffer cleared by administrator.");
    return { success: true };
};

/**
 * Check if a document is paused or cancelled
 */
const isJobPaused = (documentId) => pausedDocIds.has(String(documentId));
const isJobCancelled = (documentId) => cancelledDocIds.has(String(documentId));

/**
 * Get current overall worker status: running | idle | offline
 */
const getWorkerStatus = () => {
    if (isQueuePaused) return "offline";
    if (activeWorkers.size > 0) return "running";
    return "idle";
};

/**
 * Enqueue documents into background queue
 */
const enqueueDocuments = async ({ ids = [], category = null, allPending = false, forceRechunk = false, user = null } = {}) => {
    const filter = { status: "active" };

    if (ids && Array.isArray(ids) && ids.length > 0) {
        filter._id = { $in: ids };
    } else if (category && category !== "all" && category !== "root") {
        const escaped = String(category).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.category = { $regex: new RegExp(`^${escaped}(/.*)?$`, "i") };
    } else if (allPending) {
        filter.embeddingStatus = { $in: ["pending", "failed", "cancelled", "paused"] };
    }

    if (!forceRechunk) {
        filter.embeddingStatus = { $in: ["pending", "failed", "cancelled", "paused"] };
    }

    const docs = await Document.find(filter).select("_id originalName embeddingStatus queuePosition category");
    if (docs.length === 0) {
        emitLog("INFO", "Enqueue requested but 0 matching documents found.");
        return { count: 0, queuedIds: [] };
    }

    // Get current max queue position
    const lastQueuedDoc = await Document.findOne({ status: "active", embeddingStatus: "queued" })
        .sort({ queuePosition: -1 })
        .select("queuePosition");
    let currentPos = (lastQueuedDoc?.queuePosition || 0) + 1;

    const queuedIds = [];
    for (const doc of docs) {
        doc.embeddingStatus = "queued";
        doc.queuePosition = currentPos++;
        doc.progress = 0;
        doc.currentStage = "Queued in processing pipeline";
        doc.queueStartTime = null;
        doc.queueEndTime = null;
        doc.workerId = "";
        pausedDocIds.delete(String(doc._id));
        cancelledDocIds.delete(String(doc._id));
        await doc.save();
        queuedIds.push(doc._id);

        emitLog("INFO", `Document queued: "${doc.originalName}" [${doc.category || "General"}]`, {
            documentId: doc._id,
            fileName: doc.originalName,
            stage: "Queued"
        });
    }

    emitLog("SUCCESS", `Enqueued ${queuedIds.length} document(s) for chunking & embedding.`);
    queueEvents.emit("queue_update", { count: queuedIds.length, queuedIds });
    triggerWorkerPool();
    return { count: queuedIds.length, queuedIds };
};

/**
 * Individual worker loop
 */
const runWorker = async (workerNumber) => {
    const workerId = `Worker #${workerNumber}`;

    while (!isQueuePaused) {
        // Atomically fetch and lock next available queued document
        const document = await Document.findOneAndUpdate(
            {
                status: "active",
                embeddingStatus: "queued"
            },
            {
                $set: {
                    embeddingStatus: "processing",
                    workerId,
                    queueStartTime: new Date(),
                    progress: 5,
                    currentStage: "Starting worker pipeline"
                }
            },
            {
                sort: { queuePosition: 1, createdAt: 1 },
                new: true
            }
        );

        if (!document) {
            // Queue is empty for this worker
            break;
        }

        const docId = String(document._id);
        const startTime = Date.now();

        activeWorkers.set(workerId, {
            documentId: docId,
            originalName: document.originalName,
            category: document.category,
            stage: "Reading document",
            progress: 10,
            startTime,
            workerId
        });

        emitLog("INFO", `[${workerId}] Picked up document "${document.originalName}"`, {
            workerId,
            documentId: docId,
            fileName: document.originalName,
            stage: "Reading"
        });

        emitProgress({
            documentId: docId,
            fileName: document.originalName,
            category: document.category,
            workerId,
            status: "processing",
            stage: "Reading document",
            progress: 10,
            elapsedTime: 0
        });

        try {
            const indexingService = require("./indexingService");
            await indexingService.runIndexingPipeline(document._id, null, {
                workerId,
                onProgress: async ({ progress, stage, chunkStats }) => {
                    const elapsed = Date.now() - startTime;
                    if (activeWorkers.has(workerId)) {
                        activeWorkers.set(workerId, {
                            ...activeWorkers.get(workerId),
                            stage,
                            progress,
                            elapsedTime: elapsed
                        });
                    }

                    // Map stage to log level
                    let logLevel = "INFO";
                    if (progress >= 100 || stage.toLowerCase().includes("indexed") || stage.toLowerCase().includes("completed")) {
                        logLevel = "SUCCESS";
                    }

                    emitLog(logLevel, `[${workerId}] "${document.originalName}": ${stage} (${progress}%)`, {
                        workerId,
                        documentId: docId,
                        fileName: document.originalName,
                        stage,
                        progress
                    });

                    emitProgress({
                        documentId: docId,
                        fileName: document.originalName,
                        category: document.category,
                        workerId,
                        status: "processing",
                        stage,
                        progress,
                        chunkStats,
                        elapsedTime: elapsed
                    });
                },
                isPaused: () => isJobPaused(docId),
                isCancelled: () => isJobCancelled(docId)
            });

            // Update end stats
            const duration = Date.now() - startTime;
            await Document.updateOne(
                { _id: docId },
                {
                    $set: {
                        queueEndTime: new Date(),
                        processingDuration: duration,
                        queuePosition: 0
                    }
                }
            );

            emitLog("SUCCESS", `[${workerId}] Ingestion completed for "${document.originalName}" in ${(duration / 1000).toFixed(1)}s`, {
                workerId,
                documentId: docId,
                fileName: document.originalName,
                stage: "Completed"
            });

            emitProgress({
                documentId: docId,
                fileName: document.originalName,
                category: document.category,
                workerId,
                status: "completed",
                stage: "Completed & Indexed",
                progress: 100,
                elapsedTime: duration
            });

        } catch (err) {
            emitLog("ERROR", `[${workerId}] Ingestion failed for "${document.originalName}": ${err.message}`, {
                workerId,
                documentId: docId,
                fileName: document.originalName,
                stage: "Failed",
                details: err.stack
            });

            emitProgress({
                documentId: docId,
                fileName: document.originalName,
                category: document.category,
                workerId,
                status: "failed",
                stage: "Failed",
                progress: 0,
                error: err.message
            });
        } finally {
            activeWorkers.delete(workerId);
            pausedDocIds.delete(docId);
            cancelledDocIds.delete(docId);
        }

        // Brief yield between jobs
        await new Promise((r) => setTimeout(r, 200));
    }
};

/**
 * Trigger background worker pool up to CONCURRENCY
 */
const triggerWorkerPool = () => {
    if (isQueuePaused) return;

    for (let i = 1; i <= CONCURRENCY; i++) {
        const workerId = `Worker #${i}`;
        if (!activeWorkers.has(workerId)) {
            runWorker(i).catch((err) => {
                emitLog("ERROR", `[${workerId}] Worker pool crashed: ${err.message}`);
                activeWorkers.delete(workerId);
            });
        }
    }
};

/**
 * Global queue controls
 */
const pauseQueue = () => {
    isQueuePaused = true;
    emitLog("WARNING", "Chunking queue paused by administrator.");
    queueEvents.emit("worker_status", { status: "offline", isPaused: true });
    return { isPaused: true, activeWorkersCount: activeWorkers.size };
};

const resumeQueue = () => {
    isQueuePaused = false;
    emitLog("SUCCESS", "Chunking queue resumed. Worker pool active.");
    triggerWorkerPool();
    queueEvents.emit("worker_status", { status: "running", isPaused: false });
    return { isPaused: false, activeWorkersCount: activeWorkers.size };
};

const startWorkerPool = () => {
    isQueuePaused = false;
    emitLog("SUCCESS", "Chunking worker pool started.");
    triggerWorkerPool();
    return { success: true, status: getWorkerStatus() };
};

const stopWorkerPool = () => {
    isQueuePaused = true;
    emitLog("WARNING", "Chunking worker pool stopped.");
    return { success: true, status: "offline" };
};

const restartWorkerPool = async () => {
    emitLog("WARNING", "Restarting worker pool & cleaning up stuck tasks...");
    isQueuePaused = false;

    // Reset stuck processing tasks
    await Document.updateMany(
        { status: "active", embeddingStatus: "processing" },
        {
            $set: {
                embeddingStatus: "queued",
                workerId: "",
                currentStage: "Recovered during worker restart"
            }
        }
    );

    activeWorkers.clear();
    triggerWorkerPool();
    emitLog("SUCCESS", "Worker pool restarted successfully.");
    return { success: true, status: getWorkerStatus() };
};

const clearQueue = async () => {
    const result = await Document.updateMany(
        { status: "active", embeddingStatus: "queued" },
        {
            $set: {
                embeddingStatus: "pending",
                queuePosition: 0,
                workerId: "",
                currentStage: "Queue cleared by administrator",
                progress: 0
            }
        }
    );
    emitLog("WARNING", `Cleared ${result.modifiedCount} documents from the waiting queue.`);
    queueEvents.emit("queue_update", { cleared: result.modifiedCount });
    return { success: true, count: result.modifiedCount };
};

/**
 * Single job controls
 */
const pauseJob = async (documentId) => {
    const docId = String(documentId);
    pausedDocIds.add(docId);
    await Document.updateOne(
        { _id: docId },
        { $set: { embeddingStatus: "paused", currentStage: "Processing paused by user" } }
    );
    emitLog("WARNING", `Document processing paused: ${docId}`, { documentId: docId });
    return { success: true, documentId: docId, status: "paused" };
};

const resumeJob = async (documentId) => {
    const docId = String(documentId);
    pausedDocIds.delete(docId);
    cancelledDocIds.delete(docId);
    await Document.updateOne(
        { _id: docId },
        { $set: { embeddingStatus: "queued", currentStage: "Resumed in queue" } }
    );
    emitLog("INFO", `Document resumed: ${docId}`, { documentId: docId });
    triggerWorkerPool();
    return { success: true, documentId: docId, status: "queued" };
};

const cancelJob = async (documentId) => {
    const docId = String(documentId);
    cancelledDocIds.add(docId);
    pausedDocIds.delete(docId);
    await Document.updateOne(
        { _id: docId },
        { $set: { embeddingStatus: "cancelled", currentStage: "Processing cancelled by user", progress: 0 } }
    );
    emitLog("WARNING", `Document processing cancelled: ${docId}`, { documentId: docId });
    return { success: true, documentId: docId, status: "cancelled" };
};

const retryJob = async (documentId) => {
    emitLog("RETRY", `Retrying ingestion for document: ${documentId}`, { documentId });
    return enqueueDocuments({ ids: [documentId], forceRechunk: true });
};

const retryAllFailed = async () => {
    const failedDocs = await Document.find({
        status: "active",
        embeddingStatus: { $in: ["failed", "cancelled"] }
    }).select("_id");
    const ids = failedDocs.map((d) => d._id);
    emitLog("RETRY", `Retrying all ${ids.length} failed/cancelled ingestion jobs.`);
    return enqueueDocuments({ ids, forceRechunk: true });
};

/**
 * Startup recovery: restores queue state from MongoDB on server restart
 */
const recoverQueueOnStartup = async () => {
    try {
        // Reset stuck processing documents to queued
        const stuckDocs = await Document.updateMany(
            { status: "active", embeddingStatus: "processing" },
            {
                $set: {
                    embeddingStatus: "queued",
                    workerId: "",
                    currentStage: "Recovered after server restart"
                }
            }
        );

        if (stuckDocs.modifiedCount > 0) {
            emitLog("WARNING", `Recovered ${stuckDocs.modifiedCount} interrupted jobs back to "queued" state.`);
        }

        const queuedCount = await Document.countDocuments({ status: "active", embeddingStatus: "queued" });
        if (queuedCount > 0) {
            emitLog("INFO", `Found ${queuedCount} queued documents on startup. Starting worker pool...`);
            triggerWorkerPool();
        }
    } catch (err) {
        console.error("[ChunkingQueue] Queue recovery on startup failed:", err.message);
    }
};

/**
 * Overall queue statistics
 */
const getQueueStatus = async () => {
    const mongoose = require("mongoose");
    let queuedDocs = [];
    let completedCount = 0;
    let failedCount = 0;
    let totalCount = 0;
    let failedDocsList = [];

    if (mongoose.connection?.readyState === 1) {
        [queuedDocs, completedCount, failedCount, totalCount, failedDocsList] = await Promise.all([
            Document.find({ status: "active", embeddingStatus: "queued" })
                .select("originalName category queuePosition createdAt fileSize department mimeType")
                .sort({ queuePosition: 1 }),
            Document.countDocuments({ status: "active", embeddingStatus: { $in: ["indexed", "completed"] } }),
            Document.countDocuments({ status: "active", embeddingStatus: "failed" }),
            Document.countDocuments({ status: "active" }),
            Document.find({ status: "active", embeddingStatus: "failed" })
                .select("originalName category failureInfo currentStage updatedAt department fileSize")
                .sort({ updatedAt: -1 })
                .limit(50)
        ]);
    }

    const activeList = Array.from(activeWorkers.values());
    const overallProgressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
    const workerStatus = getWorkerStatus();
    const idleWorkers = Math.max(0, CONCURRENCY - activeList.length);

    // Calculate throughput metrics
    let avgDurationMs = 2500; // fallback 2.5s
    try {
        if (mongoose.connection?.readyState === 1) {
            const recentCompleted = await Document.find({
                status: "active",
                embeddingStatus: { $in: ["completed", "indexed"] },
                processingDuration: { $gt: 0 }
            }).select("processingDuration").limit(20).lean();

            if (recentCompleted.length > 0) {
                const totalDur = recentCompleted.reduce((sum, d) => sum + (d.processingDuration || 0), 0);
                avgDurationMs = Math.round(totalDur / recentCompleted.length);
            }
        }
    } catch (_) {}

    const docsPerMinute = avgDurationMs > 0 ? Number(((60000 / avgDurationMs) * CONCURRENCY).toFixed(1)) : 0;
    const queueEtaSeconds = Math.ceil((queuedDocs.length / Math.max(1, CONCURRENCY)) * (avgDurationMs / 1000));

    return {
        concurrency: CONCURRENCY,
        isPaused: isQueuePaused,
        workerStatus,
        activeWorkers: activeList,
        activeJobs: activeList,
        idleWorkers,
        waitingQueue: queuedDocs,
        queue: queuedDocs,
        failedDocs: failedDocsList,
        totalQueued: queuedDocs.length,
        completedCount,
        failedCount,
        totalCount,
        overallProgressPct,
        metrics: {
            avgProcessingTimeMs: avgDurationMs,
            docsPerMinute,
            queueEtaSeconds,
            etaFormatted: queueEtaSeconds > 60 ? `${Math.floor(queueEtaSeconds / 60)}m ${queueEtaSeconds % 60}s` : `${queueEtaSeconds}s`
        },
        stats: {
            queued: queuedDocs.length,
            processing: activeList.length,
            idle: idleWorkers,
            completed: completedCount,
            failed: failedCount,
            total: totalCount
        }
    };
};

module.exports = {
    enqueueDocuments,
    pauseQueue,
    resumeQueue,
    startWorkerPool,
    stopWorkerPool,
    restartWorkerPool,
    clearQueue,
    pauseJob,
    resumeJob,
    resumeDocument: resumeJob,
    cancelJob,
    cancelDocument: cancelJob,
    retryJob,
    retryDocument: retryJob,
    retryAllFailed,
    retryFailed: retryAllFailed,
    getQueueStatus,
    recoverQueueOnStartup,
    getLogs,
    clearLogs,
    emitLog,
    getWorkerStatus,
    queueEvents,
    CONCURRENCY
};
