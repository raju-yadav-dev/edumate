#!/usr/bin/env node

/**
 * EduMate Local Storage to MongoDB Synchronization Utility
 * 
 * Command: npm run sync-storage
 * 
 * Scans `storage/` root, registers any new/updated knowledge documents
 * in the MongoDB database, and reports storage statistics.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const localStorageManager = require("../storage/localStorageManager");
const Document = require("../models/Document");
const User = require("../models/User");

const MIME_MAP = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown"
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

async function syncStorage() {
    console.log("================================================================");
    console.log("     📂 EDUMATE STORAGE-TO-DATABASE SYNCHRONIZATION             ");
    console.log("================================================================");
    
    // 1. Ensure Storage Root
    const storageRoot = localStorageManager.ensureStorageRoot();
    console.log(`[Storage] Scanning Root: ${storageRoot}`);

    // 2. Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/edumate";
    console.log(`[MongoDB] Connecting to ${mongoUri.replace(/:[^:@]+@/, ":****@")}...`);
    await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to database '${mongoose.connection.name}'.\n`);

    // 3. Scan Files
    const { supportedFiles, ignoredFiles } = localStorageManager.scanKnowledgeDocuments(storageRoot);
    console.log(`[Storage] Discovered ${supportedFiles.length} valid document(s) (${ignoredFiles.length} ignored cache/internal files).\n`);

    // 4. Resolve System/Admin ID
    const adminUser = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId("64a7c8e9f1a2b3c4d5e6f7a8");

    let newlyRegistered = 0;
    let existingSynced = 0;

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

        let checksum = "local-checksum";
        try {
            const buf = fs.readFileSync(file.fullPath);
            checksum = crypto.createHash("sha256").update(buf).digest("hex");
        } catch (_) {}

        if (!doc) {
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
                    uploadedFrom: "local_storage_sync",
                    localRelativePath: file.relPath,
                    syncedAt: new Date().toISOString()
                }
            });
            newlyRegistered++;
            console.log(`  + [NEW] Registered: ${file.relPath} (ID: ${doc._id})`);
        } else {
            let updated = false;
            if (doc.storagePath !== file.relPath) {
                doc.storagePath = file.relPath;
                updated = true;
            }
            if (doc.fileSize !== file.size) {
                doc.fileSize = file.size;
                updated = true;
            }
            if (checksum !== doc.checksum) {
                doc.checksum = checksum;
                updated = true;
            }
            if (updated) {
                await doc.save();
            }
            existingSynced++;
        }
    }

    // 5. Storage Metrics
    const stats = localStorageManager.getLocalStorageStats();

    console.log("\n================================================================");
    console.log("             ✅ STORAGE SYNCHRONIZATION COMPLETE                 ");
    console.log("================================================================");
    console.log(`📄 Newly Registered:   ${newlyRegistered}`);
    console.log(`🔄 Existing Synced:     ${existingSynced}`);
    console.log(`📂 Total Stored Files:  ${stats.files}`);
    console.log(`📁 Category Folders:    ${stats.folders}`);
    console.log(`📦 Storage Volume:      ${stats.usedFormatted}`);
    console.log("================================================================\n");

    await mongoose.disconnect();
    process.exit(0);
}

syncStorage().catch(async (err) => {
    console.error("\n❌ [Storage Sync Error]:", err.message);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
