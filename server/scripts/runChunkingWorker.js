#!/usr/bin/env node

/**
 * EduMate Dedicated Chunking Runtime Worker (Mission 15.1 Production Grade)
 * 
 * Usage:
 *   npm run chunking
 *   node server/scripts/runChunkingWorker.js [--force] [--all]
 * 
 * Features:
 *   - Strictly operates on `storage/` root, strictly ignores internal cache & generated artifacts
 *   - Only ingests supported document types (PDF, DOCX, TXT, Markdown)
 *   - Recovers Qdrant collection automatically if missing, checks availability before running
 *   - Gracefully degrades llama.cpp metadata extraction to local regex extractor
 *   - Validates strict chunk count === vector count before marking Completed
 *   - Cleans up temporary processing artifacts
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const localStorageManager = require("../storage/localStorageManager");
const Document = require("../models/Document");
const chunkingQueueService = require("../ai/services/chunkingQueueService");
const { client: qdrantClient, collectionName: qdrantCollection, ensureCollection } = require("../ai/config/qdrant");

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
    ".jfif": "image/jpeg",
    ".jpe": "image/jpeg",
    ".webp": "image/webp"
};

const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_MAP[ext] || "application/octet-stream";
};

const inferCategoryFromPath = (relPath) => {
    const parts = String(relPath || "").replace(/\\/g, "/").split("/");
    if (parts.length > 1) {
        return parts[0].toLowerCase();
    }
    return "general";
};

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
            console.log(`[Cleanup] Purged ${deleted.deletedCount} corrupted/cache records from MongoDB.`);
        }
    } catch (_) {}
}

async function main() {
    console.log("================================================================");
    console.log("     🚀 EDUMATE DEDICATED CHUNKING RUNTIME (MISSION 15.1)       ");
    console.log("================================================================");
    console.log(`[Runtime] PID: ${process.pid} | Node: ${process.version}`);
    console.log(`[Storage] Knowledge Storage Root: ${localStorageManager.STORAGE_ROOT}`);

    const isForce = process.argv.includes("--force") || process.argv.includes("-f");
    const isAll = process.argv.includes("--all") || process.argv.includes("-a");

    if (isForce) console.log("[Runtime] Flag --force enabled: Re-chunking existing documents.");
    if (isAll) console.log("[Runtime] Flag --all enabled: Enqueueing all knowledge documents.");

    // 1. Initialize Local Storage Root
    const storageRoot = localStorageManager.ensureStorageRoot();
    console.log(`[Storage] Local storage initialized at: ${storageRoot}`);

    // 2. Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/edumate";
    console.log(`[MongoDB] Connecting to database...`);
    await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to ${mongoose.connection.name}.`);

    // Clean up any old corrupted cache records
    await cleanupCorruptedDocuments();

    // 3. Verify Qdrant connection & ensure collection
    console.log(`[Qdrant] Verifying vector database (${qdrantCollection})...`);
    let isQdrantReady = false;
    try {
        if (typeof ensureCollection === "function") {
            await ensureCollection();
        }
        const info = await qdrantClient.getCollection(qdrantCollection);
        const vectorsCount = info.vectors_count || info.points_count || 0;
        console.log(`[Qdrant] ✓ Connected. Collection '${qdrantCollection}' ready with ${vectorsCount} indexed vectors.`);
        isQdrantReady = true;
    } catch (qErr) {
        console.warn(`[Qdrant] ⚠️ Warning: Qdrant check returned: ${qErr.message}`);
        console.warn("[Qdrant] Runtime will proceed, documents requiring vector upload will wait for Qdrant.");
    }

    // 4. Strict Storage Scan (Only supported docs, skipping all cache & generated files)
    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(storageRoot);
    console.log(`[Storage] Discovered ${supportedFiles.length} supported document(s) (Ignored ${ignoredFiles.length} internal/cache files).`);

    // 5. Synchronize disk files with MongoDB Document collection
    let syncCount = 0;
    const documentIdsToProcess = [];
    const crypto = require("crypto");
    const User = require("../models/User");
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");

    for (const file of supportedFiles) {
        let doc = await Document.findOne({
            $or: [
                { storagePath: file.relPath },
                { "metadata.localRelativePath": file.relPath }
            ],
            status: { $ne: "deleted" }
        });

        const category = inferCategoryFromPath(file.relPath);
        const mimeType = getMimeType(file.fullPath);

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
                currentStage: "Discovered on local storage root",
                metadata: {
                    uploadedFrom: "local_storage_scan",
                    localRelativePath: file.relPath,
                    discoveredAt: new Date().toISOString()
                }
            });
            syncCount++;
            console.log(`[Sync] Registered new document: ${file.relPath} (ID: ${doc._id})`);
        } else {
            if (!doc.storagePath) {
                doc.storagePath = file.relPath;
                await doc.save();
            }
        }

        // Determine if document should be processed
        const isCompleted = doc.embeddingStatus === "completed" || doc.embeddingStatus === "indexed";
        const hasZeroVectors = !doc.chunkStats?.indexedChunks || doc.chunkStats.indexedChunks === 0;

        if (isForce || isAll || !isCompleted || hasZeroVectors) {
            documentIdsToProcess.push(doc._id);
        }
    }

    if (syncCount > 0) {
        console.log(`[Sync] Registered ${syncCount} new document(s) from local storage.`);
    }

    // Also include any other pending/failed documents in database
    const pendingInDb = await Document.find({
        status: "active",
        embeddingStatus: { $in: ["pending", "failed", "cancelled", "paused", "queued", "partial"] }
    }).select("_id originalName");

    for (const p of pendingInDb) {
        if (!documentIdsToProcess.some(id => String(id) === String(p._id))) {
            documentIdsToProcess.push(p._id);
        }
    }

    if (documentIdsToProcess.length === 0) {
        console.log("\n================================================================");
        console.log(" ✅ All documents in storage/ are already chunked and indexed!");
        console.log("================================================================");
        await mongoose.disconnect();
        process.exit(0);
    }

    console.log(`\n[Chunking] Enqueueing ${documentIdsToProcess.length} document(s) for processing...`);

    // 6. Hook progress events for CLI logging
    chunkingQueueService.queueEvents.on("progress", (data) => {
        const percent = String(data.progress || 0).padStart(3, " ");
        console.log(`[Worker] [${data.workerId || "Worker"}] Doc ${data.documentId} | ${percent}% | ${data.stage || data.status}`);
    });

    // 7. Enqueue documents
    await chunkingQueueService.enqueueDocuments({
        ids: documentIdsToProcess,
        forceRechunk: isForce || isAll
    });

    // 8. Poll until queue completes
    const pollInterval = 1000;
    let idleTicks = 0;

    await new Promise((resolve) => {
        const interval = setInterval(async () => {
            try {
                const status = await chunkingQueueService.getQueueStatus();
                const queued = status.stats?.queued || 0;
                const processing = status.stats?.processing || 0;

                if (queued === 0 && processing === 0) {
                    idleTicks++;
                    if (idleTicks >= 2) {
                        clearInterval(interval);
                        resolve();
                    }
                } else {
                    idleTicks = 0;
                }
            } catch (err) {
                console.error("[Chunking] Status check error:", err.message);
            }
        }, pollInterval);
    });

    // 9. Final Verification & Stats
    const stats = localStorageManager.getLocalStorageStats();
    let qdrantPointCount = 0;
    try {
        const info = await qdrantClient.getCollection(qdrantCollection);
        qdrantPointCount = info.vectors_count || info.points_count || 0;
    } catch (_) {}

    const completedDocs = await Document.countDocuments({ status: "active", embeddingStatus: { $in: ["completed", "indexed"] } });
    const failedDocs = await Document.countDocuments({ status: "active", embeddingStatus: "failed" });
    const partialDocs = await Document.countDocuments({ status: "active", embeddingStatus: "partial" });
    const totalDocs = await Document.countDocuments({ status: "active" });

    console.log("\n================================================================");
    console.log("             🎉 CHUNKING RUNTIME COMPLETED                      ");
    console.log("================================================================");
    console.log(`📂 Knowledge Files:     ${stats.supportedDocuments} document(s) across ${stats.folders} folder(s)`);
    console.log(`🚫 Ignored Artifacts:   ${stats.ignoredFiles} file(s) (cache/chunks)`);
    console.log(`📦 Storage Used:        ${(stats.used / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📄 Total Documents:     ${totalDocs}`);
    console.log(`✅ Indexed Documents:   ${completedDocs}`);
    console.log(`⚠️ Partial Documents:   ${partialDocs}`);
    console.log(`❌ Failed Documents:    ${failedDocs}`);
    console.log(`🧬 Qdrant Vectors:      ${qdrantPointCount}`);
    console.log("================================================================\n");

    await mongoose.disconnect();
    console.log("[Runtime] Chunking worker completed cleanly. Exiting with code 0.");
    process.exit(0);
}

main().catch(async (err) => {
    console.error("\n❌ [Chunking Runtime Fatal Error]:", err);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
