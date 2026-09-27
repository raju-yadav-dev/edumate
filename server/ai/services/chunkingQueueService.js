const EventEmitter = require("events");
const Document = require("../../models/Document");

const queueEvents = new EventEmitter();
const CONCURRENCY = Math.max(1, parseInt(process.env.CHUNKING_QUEUE_CONCURRENCY || "2", 10));

let isQueuePaused = false;
const activeWorkers = new Map(); // workerId -> { documentId, originalName, stage, progress, startTime, timer }
const pausedDocIds = new Set();
const cancelledDocIds = new Set();
let isWorkerPoolRunning = false;

/**
 * Emit real-time progress update event for a document
 */
const emitProgress = (payload) => {
    queueEvents.emit("progress", payload);
};

/**
 * Check if a document is paused or cancelled
 */
const isJobPaused = (documentId) => pausedDocIds.has(String(documentId));
const isJobCancelled = (documentId) => cancelledDocIds.has(String(documentId));

/**
 * Enqueue documents into background queue
 */
const enqueueDocuments = async ({ ids = [], category = null, allPending = false, forceRechunk = false, user = null }) => {
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

    const docs = await Document.find(filter).select("_id originalName embeddingStatus queuePosition");
    if (docs.length === 0) {
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
    }

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
            stage: "Reading document",
            progress: 10,
            startTime,
            workerId
        });

        emitProgress({
            documentId: docId,
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

                    emitProgress({
                        documentId: docId,
                        workerId,
                        status: document.embeddingStatus,
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
        } catch (err) {
            console.error(`[ChunkingQueue] ${workerId} failed processing ${docId} (${document.originalName}):`, err.message);
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
                console.error(`[ChunkingQueue] ${workerId} error:`, err);
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
    return { isPaused: true, activeWorkersCount: activeWorkers.size };
};

const resumeQueue = () => {
    isQueuePaused = false;
    triggerWorkerPool();
    return { isPaused: false, activeWorkersCount: activeWorkers.size };
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
    return { success: true, documentId: docId, status: "cancelled" };
};

const retryJob = async (documentId) => {
    return enqueueDocuments({ ids: [documentId], forceRechunk: true });
};

const retryAllFailed = async () => {
    const failedDocs = await Document.find({
        status: "active",
        embeddingStatus: { $in: ["failed", "cancelled"] }
    }).select("_id");
    const ids = failedDocs.map((d) => d._id);
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
            console.log(`[ChunkingQueue] Recovered ${stuckDocs.modifiedCount} interrupted jobs back to "queued" state.`);
        }

        const queuedCount = await Document.countDocuments({ status: "active", embeddingStatus: "queued" });
        if (queuedCount > 0) {
            console.log(`[ChunkingQueue] Found ${queuedCount} queued documents. Starting background worker pool (${CONCURRENCY} workers)...`);
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

    if (mongoose.connection?.readyState === 1) {
        [queuedDocs, completedCount, failedCount, totalCount] = await Promise.all([
            Document.find({ status: "active", embeddingStatus: "queued" })
                .select("originalName category queuePosition createdAt fileSize")
                .sort({ queuePosition: 1 }),
            Document.countDocuments({ status: "active", embeddingStatus: { $in: ["indexed", "completed"] } }),
            Document.countDocuments({ status: "active", embeddingStatus: "failed" }),
            Document.countDocuments({ status: "active" })
        ]);
    }

    const activeList = Array.from(activeWorkers.values());
    const overallProgressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

    return {
        concurrency: CONCURRENCY,
        isPaused: isQueuePaused,
        activeWorkers: activeList,
        activeJobs: activeList,
        waitingQueue: queuedDocs,
        queue: queuedDocs,
        totalQueued: queuedDocs.length,
        completedCount,
        failedCount,
        totalCount,
        overallProgressPct,
        stats: {
            queued: queuedDocs.length,
            processing: activeList.length,
            completed: completedCount,
            failed: failedCount
        }
    };
};

module.exports = {
    enqueueDocuments,
    pauseQueue,
    resumeQueue,
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
    queueEvents,
    CONCURRENCY
};

