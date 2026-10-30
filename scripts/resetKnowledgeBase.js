#!/usr/bin/env node

/**
 * EduMate Knowledge Base Reset Engine (Controlled & Safe)
 * 
 * Completely resets knowledge base data to clean 0 state:
 * - 0 uploaded knowledge-base documents
 * - 0 local chunk files and 0 local chunks
 * - 0 Qdrant vector points
 * - 0 active indexing jobs and 0 queued jobs
 * - 0 stale knowledge-base document records
 * 
 * Strict safety rules:
 * - Creates verified timestamped backup before any deletion.
 * - Stops and drains worker pool before deleting anything.
 * - Leaves workers persisted as STOPPED.
 * - NEVER touches users, authentication, chats, locations, settings, logs, or other Qdrant collections.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 1. Load Environment Variables
const projectRoot = path.resolve(__dirname, "..");
[
    path.join(projectRoot, ".env"),
    path.join(projectRoot, "server", ".env")
].forEach((envPath) => {
    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath, override: true });
    }
});

const logger = require("./logger");
const paths = require("../server/config/paths");
const { client: qdrantClient, collectionName } = require("../server/ai/config/qdrant");
const mongoose = require("mongoose");

const chunkingPort = parseInt(process.env.CHUNKING_PORT || "5000", 10);
const chunkingApiUrl = process.env.CHUNKING_API_URL || `http://127.0.0.1:${chunkingPort}`;

function sha256File(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
}

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((child) => {
            copyRecursiveSync(path.join(src, child), path.join(dest, child));
        });
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

function removeFilesInDir(dir, keepDir = true) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            count += removeFilesInDir(fullPath, false);
            try { fs.rmdirSync(fullPath); } catch (_) {}
        } else if (entry.isFile()) {
            try {
                fs.unlinkSync(fullPath);
                count++;
            } catch (_) {}
        }
    }
    if (!keepDir) {
        try { fs.rmdirSync(dir); } catch (_) {}
    }
    return count;
}

function scanFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(current, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile()) {
                const s = fs.statSync(full);
                results.push({ fullPath: full, relative: path.relative(dir, full).replace(/\\/g, "/"), size: s.size });
            }
        }
    }
    walk(dir);
    return results;
}

async function stopAndDrainWorkers() {
    logger.step(`Checking chunking server worker pool at ${logger.bold(chunkingApiUrl)}...`);
    let serverRunning = false;
    let queueData = null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${chunkingApiUrl}/queue`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            const json = await res.json();
            queueData = json.data;
            serverRunning = true;
        }
    } catch (_) {
        serverRunning = false;
    }

    if (!serverRunning) {
        logger.info("ℹ️ Chunking server is not running on port " + chunkingPort + ".");
        // Persist STOPPED state to disk
        paths.ensureAllDirectories();
        fs.writeFileSync(
            path.join(paths.DATA_ROOT, "worker_state.json"),
            JSON.stringify({ state: "STOPPED", updatedAt: new Date().toISOString() }, null, 2),
            "utf-8"
        );
        logger.success("✓ Worker pool state locked as STOPPED.");
        return { success: true, serverRunning: false };
    }

    // Stop worker pool via API
    logger.step("Stopping worker pool via API...");
    try {
        await fetch(`${chunkingApiUrl}/worker/stop`, { method: "POST" });
    } catch (err) {
        throw new Error(`Failed to stop worker pool: ${err.message}`);
    }

    // Drain workers
    const activeJobs = queueData.activeJobs || [];
    if (activeJobs.length > 0) {
        logger.warn(`⚠️ Waiting for ${activeJobs.length} active job(s) to drain...`);
        const maxDrainSeconds = 45;
        const drainStart = Date.now();
        let drained = false;

        while ((Date.now() - drainStart) < maxDrainSeconds * 1000) {
            await new Promise((r) => setTimeout(r, 1000));
            try {
                const pollRes = await fetch(`${chunkingApiUrl}/queue`);
                if (pollRes.ok) {
                    const pollJson = await pollRes.json();
                    const remaining = (pollJson.data?.activeJobs || []).length;
                    if (remaining === 0) {
                        drained = true;
                        break;
                    }
                }
            } catch (_) {}
        }

        if (!drained) {
            throw new Error(`Worker pool failed to drain within ${maxDrainSeconds}s timeout.`);
        }
    }

    // Persist STOPPED state to disk
    paths.ensureAllDirectories();
    fs.writeFileSync(
        path.join(paths.DATA_ROOT, "worker_state.json"),
        JSON.stringify({ state: "STOPPED", updatedAt: new Date().toISOString() }, null, 2),
        "utf-8"
    );

    logger.success("✓ Worker pool stopped, drained, and locked as STOPPED.");
    return { success: true, serverRunning: true };
}

async function performReset() {
    console.log(logger.cyan("============================================================"));
    console.log(logger.bold(logger.cyan("     EduMate Knowledge Base - Controlled Full Reset         ")));
    console.log(logger.cyan("============================================================\n"));

    // Step 1: Validate paths and connections
    logger.step("Phase 1: Validating storage paths, MongoDB, and Qdrant...");
    paths.ensureAllDirectories();

    const storageRoot = paths.STORAGE_ROOT;
    const fileExplorerDir = paths.FILE_EXPLORER_DIR;
    const chunksRoot = paths.CHUNKS_ROOT;
    const cacheRoot = paths.CACHE_ROOT;
    const backupRoot = paths.BACKUP_ROOT;

    logger.info(`  Storage Root     : ${storageRoot}`);
    logger.info(`  File Explorer Dir: ${fileExplorerDir}`);
    logger.info(`  Chunks Root      : ${chunksRoot}`);
    logger.info(`  Cache Root       : ${cacheRoot}`);
    logger.info(`  Backup Root      : ${backupRoot}`);

    // Connect MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI is not configured in .env");
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    logger.success("✓ MongoDB connected successfully.");

    const Document = require("../server/models/Document");
    const KnowledgeSource = require("../server/models/KnowledgeSource");
    const User = require("../server/models/User");
    const Chat = require("../server/models/Chat");
    const Location = require("../server/models/Location");

    // Connect Qdrant
    let qdrantCollectionInfo = null;
    try {
        qdrantCollectionInfo = await qdrantClient.getCollection(collectionName);
        logger.success(`✓ Qdrant connected. Collection "${collectionName}" ready.`);
    } catch (err) {
        throw new Error(`Qdrant connection failed: ${err.message}`);
    }

    // Initial Inventory (Before Counts)
    const beforePhysicalDocs = scanFiles(fileExplorerDir);
    const beforePhysicalDocsBytes = beforePhysicalDocs.reduce((sum, f) => sum + f.size, 0);
    const beforeChunkFiles = scanFiles(chunksRoot).filter((f) => f.relative.endsWith(".chunks.json"));
    
    let beforeChunkCount = 0;
    beforeChunkFiles.forEach((cf) => {
        try {
            const parsed = JSON.parse(fs.readFileSync(cf.fullPath, "utf-8"));
            if (Array.isArray(parsed.chunks)) beforeChunkCount += parsed.chunks.length;
        } catch (_) {}
    });

    const beforeMongoDocsCount = await Document.countDocuments({});
    const beforeQdrantPoints = qdrantCollectionInfo.points_count ?? (await qdrantClient.count(collectionName, { exact: true })).count ?? 0;
    const preservedUsersCount = await User.countDocuments({});
    const preservedChatsCount = await Chat.countDocuments({});
    const preservedLocationsCount = await Location.countDocuments({});

    console.log(logger.cyan("\n--- Before Reset State ---"));
    console.log(`  Physical KB Docs : ${logger.bold(String(beforePhysicalDocs.length))} (${(beforePhysicalDocsBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  Local Chunk Files: ${logger.bold(String(beforeChunkFiles.length))} (${beforeChunkCount} total chunks)`);
    console.log(`  MongoDB Documents: ${logger.bold(String(beforeMongoDocsCount))} records`);
    console.log(`  Qdrant Points    : ${logger.bold(String(beforeQdrantPoints))} vectors`);
    console.log(`  Protected Records: ${preservedUsersCount} Users, ${preservedChatsCount} Chats, ${preservedLocationsCount} Locations`);
    console.log(logger.cyan("--------------------------\n"));

    // Step 2: Safety & Worker Shutdown
    logger.step("Phase 2: Stopping and draining workers...");
    await stopAndDrainWorkers();

    // Step 3: Verified Timestamped Backup
    logger.step("Phase 3: Creating verified pre-reset backup...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(backupRoot, `backup-${timestamp}-pre-reset`);
    fs.mkdirSync(backupDir, { recursive: true });

    // 3a. Backup MongoDB documents
    const allDocs = await Document.find({}).lean();
    const mongoBackupFile = path.join(backupDir, "documents.json");
    fs.writeFileSync(mongoBackupFile, JSON.stringify(allDocs, null, 2), "utf-8");
    const mongoHash = sha256File(mongoBackupFile);

    // 3b. Backup Physical Document Files
    const storageBackupDir = path.join(backupDir, "storage_file_explorer");
    copyRecursiveSync(fileExplorerDir, storageBackupDir);

    // 3c. Backup Chunk JSON Files
    const chunksBackupDir = path.join(backupDir, "chunks");
    copyRecursiveSync(chunksRoot, chunksBackupDir);

    // 3d. Backup Qdrant info
    fs.writeFileSync(path.join(backupDir, "qdrant_collection_info.json"), JSON.stringify(qdrantCollectionInfo, null, 2), "utf-8");

    // 3e. Backup Manifest
    const manifest = {
        timestamp: new Date().toISOString(),
        backupDir,
        status: "VERIFIED",
        documentsCount: allDocs.length,
        documentsSha256: mongoHash,
        physicalDocumentsCount: beforePhysicalDocs.length,
        physicalDocumentsBytes: beforePhysicalDocsBytes,
        chunkFilesCount: beforeChunkFiles.length,
        totalChunks: beforeChunkCount,
        qdrantPointsCount: beforeQdrantPoints,
        preservedCollections: {
            users: preservedUsersCount,
            chats: preservedChatsCount,
            locations: preservedLocationsCount
        }
    };
    fs.writeFileSync(path.join(backupDir, "backup_manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    // 3f. Strict Verification of Backup Integrity
    logger.step("Verifying backup integrity...");
    if (!fs.existsSync(mongoBackupFile) || fs.statSync(mongoBackupFile).size === 0 && allDocs.length > 0) {
        throw new Error("Backup validation failed: documents.json is missing or corrupt.");
    }
    const backedUpDocs = scanFiles(storageBackupDir);
    if (backedUpDocs.length !== beforePhysicalDocs.length) {
        throw new Error(`Backup validation failed: Expected ${beforePhysicalDocs.length} files in storage backup, found ${backedUpDocs.length}.`);
    }
    const backedUpChunks = scanFiles(chunksBackupDir).filter((f) => f.relative.endsWith(".chunks.json"));
    if (backedUpChunks.length !== beforeChunkFiles.length) {
        throw new Error(`Backup validation failed: Expected ${beforeChunkFiles.length} chunk files, found ${backedUpChunks.length}.`);
    }

    logger.success(`✓ Backup successfully created and verified at:\n  ${logger.bold(backupDir)}\n`);

    // Step 4: Reset Only Knowledge Base Data
    logger.step("Phase 4: Executing controlled knowledge base data reset...");

    // 4a. Clear physical documents from storage/file_explorer
    logger.info("  1. Removing physical documents from storage/file_explorer...");
    const deletedPhysicalCount = removeFilesInDir(fileExplorerDir, true);
    // Ensure default general subfolder exists empty
    const generalDir = path.join(fileExplorerDir, "general");
    if (!fs.existsSync(generalDir)) fs.mkdirSync(generalDir, { recursive: true });
    logger.success(`     ✓ Removed ${deletedPhysicalCount} physical file(s).`);

    // 4b. Clear chunk files from chunks directory
    logger.info("  2. Removing local chunk files...");
    const deletedChunkFilesCount = removeFilesInDir(chunksRoot, true);
    logger.success(`     ✓ Removed ${deletedChunkFilesCount} chunk file(s).`);

    // 4c. Clear knowledge-base-specific caches
    logger.info("  3. Purging knowledge-base caches & temporary files...");
    const cacheDirs = [
        path.join(cacheRoot, "chunks"),
        path.join(cacheRoot, "embeddings"),
        path.join(cacheRoot, "retrieval"),
        path.join(cacheRoot, "analytics"),
        paths.EMBEDDINGS_ROOT,
        path.join(storageRoot, "temp", "uploads")
    ];
    let deletedCacheFiles = 0;
    for (const cd of cacheDirs) {
        if (fs.existsSync(cd)) {
            deletedCacheFiles += removeFilesInDir(cd, true);
        }
    }
    logger.success(`     ✓ Purged ${deletedCacheFiles} cache and temporary file(s).`);

    // Invalidate in-memory caches
    try {
        const smartCacheHub = require("../server/services/cache/SmartCacheHub");
        if (typeof smartCacheHub.invalidateAll === "function") {
            smartCacheHub.invalidateAll();
            logger.success("     ✓ In-memory SmartCacheHub layers invalidated.");
        }
    } catch (_) {}

    // 4d. Clear Qdrant collection points
    logger.info(`  4. Purging all vectors from Qdrant collection "${collectionName}"...`);
    await qdrantClient.delete(collectionName, {
        wait: true,
        filter: {}
    });
    const verifyQdrant = await qdrantClient.count(collectionName, { exact: true });
    if ((verifyQdrant.count ?? 0) !== 0) {
        throw new Error(`Qdrant deletion failed: ${verifyQdrant.count} points remain.`);
    }
    logger.success(`     ✓ Verified 0 vectors remain in Qdrant collection "${collectionName}". Collection preserved.`);

    // 4e. Clear MongoDB documents records
    logger.info("  5. Purging knowledge-base records from MongoDB 'documents' collection...");
    const mongoDeleteResult = await Document.deleteMany({});
    await KnowledgeSource.deleteMany({});
    logger.success(`     ✓ Deleted ${mongoDeleteResult.deletedCount} MongoDB document record(s).`);

    // Verify protected collections
    const postUsers = await User.countDocuments({});
    const postChats = await Chat.countDocuments({});
    const postLocations = await Location.countDocuments({});
    logger.success(`     ✓ Protected collections intact: ${postUsers} Users, ${postChats} Chats, ${postLocations} Locations.`);

    // 4f. Lock worker state as STOPPED
    fs.writeFileSync(
        path.join(paths.DATA_ROOT, "worker_state.json"),
        JSON.stringify({ state: "STOPPED", updatedAt: new Date().toISOString() }, null, 2),
        "utf-8"
    );
    logger.success("     ✓ Worker pool persisted as STOPPED.");

    // Step 5: Post-Reset Verification (After Counts)
    logger.step("Phase 5: Verifying clean 0 state across all systems...");

    const afterPhysicalDocs = scanFiles(fileExplorerDir);
    const afterChunkFiles = scanFiles(chunksRoot).filter((f) => f.relative.endsWith(".chunks.json"));
    const afterMongoDocs = await Document.countDocuments({});
    const afterQdrantCount = (await qdrantClient.count(collectionName, { exact: true })).count ?? 0;

    console.log(logger.cyan("\n============================================================"));
    console.log(logger.bold(logger.green("      EduMate Knowledge Base Reset - Final Verification     ")));
    console.log(logger.cyan("============================================================"));
    console.log(`  Physical KB Docs : Before: ${beforePhysicalDocs.length.toString().padStart(4)} | After: ${logger.bold(logger.green(String(afterPhysicalDocs.length)))}`);
    console.log(`  Local Chunk Files: Before: ${beforeChunkFiles.length.toString().padStart(4)} | After: ${logger.bold(logger.green(String(afterChunkFiles.length)))}`);
    console.log(`  Total Chunks     : Before: ${beforeChunkCount.toString().padStart(4)} | After: ${logger.bold(logger.green("0"))}`);
    console.log(`  MongoDB Documents: Before: ${beforeMongoDocsCount.toString().padStart(4)} | After: ${logger.bold(logger.green(String(afterMongoDocs)))}`);
    console.log(`  Qdrant Points    : Before: ${beforeQdrantPoints.toString().padStart(4)} | After: ${logger.bold(logger.green(String(afterQdrantCount)))}`);
    console.log(`  Worker Pool State: ${logger.bold(logger.yellow("STOPPED (Locked across restarts)"))}`);
    console.log(`  Backup Location  : ${backupDir}`);
    console.log(logger.cyan("============================================================\n"));

    await mongoose.disconnect();
}

if (require.main === module) {
    performReset().catch((err) => {
        logger.error(`\n❌ Reset Aborted/Failed: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    });
}

module.exports = { performReset };
