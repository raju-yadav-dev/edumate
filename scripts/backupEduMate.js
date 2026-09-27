const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

async function backupEduMate() {
    console.log("============================================================");
    console.log("       EduMate Knowledge Base & System Backup Utility       ");
    console.log("============================================================\n");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.resolve(process.cwd(), "backups", `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`Backup Destination: ${backupDir}\n`);

    // 1. Backup MongoDB Documents & Local Chunks
    console.log("1. Exporting MongoDB Knowledge Base Documents & Local Chunks...");
    let mongoose;
    try {
        mongoose = require("mongoose");
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        
        const Document = require("../server/models/Document");
        const localChunkManager = require("../server/storage/localChunkManager");

        const docs = await Document.find({}).lean();
        const chunkStats = await localChunkManager.getAllChunkStats();

        fs.writeFileSync(path.join(backupDir, "documents.json"), JSON.stringify(docs, null, 2), "utf8");
        fs.writeFileSync(path.join(backupDir, "chunkStats.json"), JSON.stringify(chunkStats, null, 2), "utf8");

        console.log(`✓ Exported ${docs.length} documents and stats for ${chunkStats.totalChunks} local chunks.\n`);
        await mongoose.disconnect();
    } catch (err) {
        console.warn(`⚠️ MongoDB backup skipped: ${err.message}\n`);
    }

    // 2. Backup Qdrant Metadata
    console.log("2. Exporting Qdrant Vector Collection Metadata...");
    try {
        const { client, collectionName } = require("../server/ai/config/qdrant");
        const info = await client.getCollection(collectionName).catch(() => null);
        if (info) {
            fs.writeFileSync(path.join(backupDir, "qdrant_collection_info.json"), JSON.stringify(info, null, 2), "utf8");
            console.log(`✓ Exported Qdrant collection metadata (${info.points_count || 0} vectors).\n`);
        }
    } catch (err) {
        console.warn(`⚠️ Qdrant metadata backup skipped: ${err.message}\n`);
    }

    // 3. Backup Manifest
    const manifest = {
        timestamp: new Date().toISOString(),
        backupDirectory: backupDir,
        nodeEnv: process.env.NODE_ENV || "development",
        status: "COMPLETED_SUCCESSFULLY"
    };

    fs.writeFileSync(path.join(backupDir, "backup_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    console.log("============================================================");
    console.log(`✓ BACKUP COMPLETE: ${backupDir}`);
    console.log("============================================================\n");
}

if (require.main === module) {
    backupEduMate().catch(err => {
        console.error("Backup failed:", err);
        process.exit(1);
    });
}

module.exports = backupEduMate;
