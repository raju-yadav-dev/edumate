#!/usr/bin/env node

/**
 * EduMate Dedicated Chunking Runtime Worker
 * 
 * Usage:
 *   npm run chunking
 *   node server/scripts/runChunkingWorker.js [--force] [--all]
 * 
 * Features:
 *   - Operates strictly on local knowledge storage root `storage/`
 *   - Starts ONLY the chunking pipeline (Local Storage Manager, Chunking Queue Worker,
 *     PDF Parser, Metadata Extractor, Chunk Generator, Embedding Generator, Qdrant Indexer)
 *   - Does NOT launch web server, express, chat runtime, voice assistant, or frontend
 *   - Auto-discovers files in `storage/` and synchronizes Document records
 *   - Processes queue to completion and exits cleanly with exit code 0
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const localStorageManager = require("../storage/localStorageManager");
const Document = require("../models/Document");
const chunkingQueueService = require("../ai/services/chunkingQueueService");
const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");

const MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json"
};

const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_MAP[ext] || "application/octet-stream";
};

const scanStorageFiles = (dir, rootDir = dir) => {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip internal chunk storage and hidden folders
            if (entry.name === "chunks" || entry.name === ".chunks" || entry.name.startsWith(".")) {
                continue;
            }
            results.push(...scanStorageFiles(fullPath, rootDir));
        } else if (entry.isFile()) {
            if (entry.name.endsWith(".chunks.json") || entry.name.endsWith(".tmp")) {
                continue;
            }
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
            const stat = fs.statSync(fullPath);
            results.push({
                fullPath,
                relPath,
                fileName: entry.name,
                size: stat.size,
                mtime: stat.mtime
            });
        }
    }
    return results;
};

const inferCategoryFromPath = (relPath) => {
    const parts = relPath.split("/");
    if (parts.length > 1) {
        return parts[0].toLowerCase();
    }
    return "general";
};

async function main() {
    console.log("================================================================");
    console.log("             🚀 EDUMATE DEDICATED CHUNKING RUNTIME             ");
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

    // 3. Verify Qdrant connection
    console.log(`[Qdrant] Verifying vector database (${qdrantCollection})...`);
    try {
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections?.some((c) => c.name === qdrantCollection);
        if (exists) {
            const info = await qdrantClient.getCollection(qdrantCollection);
            console.log(`[Qdrant] Connected. Vectors in collection: ${info.vectors_count || info.points_count || 0}`);
        } else {
            console.log(`[Qdrant] Collection ${qdrantCollection} not found. Creating...`);
            const { initQdrant } = require("../ai/config/qdrant");
            if (typeof initQdrant === "function") await initQdrant();
        }
    } catch (qErr) {
        console.warn(`[Qdrant] Warning: Qdrant check returned: ${qErr.message}`);
    }

    // 4. Scan files in local storage root
    const diskFiles = scanStorageFiles(storageRoot);
    console.log(`[Storage] Discovered ${diskFiles.length} file(s) in local storage/ directory.`);

    // 5. Synchronize disk files with MongoDB Document collection
    let syncCount = 0;
    const documentIdsToProcess = [];
    const crypto = require("crypto");
    const User = require("../models/User");
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");

    for (const file of diskFiles) {
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
            console.log(`[Sync] Registered new document in MongoDB: ${file.relPath} (ID: ${doc._id})`);
        } else {
            // Update storagePath if missing
            if (!doc.storagePath) {
                doc.storagePath = file.relPath;
                await doc.save();
            }
        }

        if (isForce || isAll || doc.embeddingStatus !== "completed") {
            documentIdsToProcess.push(doc._id);
        }
    }

    if (syncCount > 0) {
        console.log(`[Sync] Registered ${syncCount} new document(s) from local storage.`);
    }

    // Also include any other pending/failed documents in database
    const pendingInDb = await Document.find({
        status: "active",
        embeddingStatus: { $in: ["pending", "failed", "cancelled", "paused", "queued"] }
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
    const totalDocs = await Document.countDocuments({ status: "active" });

    console.log("\n================================================================");
    console.log("             🎉 CHUNKING RUNTIME COMPLETED                      ");
    console.log("================================================================");
    console.log(`📂 Storage Files:       ${stats.files} file(s) across ${stats.folders} folder(s)`);
    console.log(`📦 Storage Used:        ${(stats.used / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📄 Total Documents:     ${totalDocs}`);
    console.log(`✅ Indexed Documents:   ${completedDocs}`);
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
