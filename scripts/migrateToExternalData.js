const fs = require("fs");
const path = require("path");
const paths = require("../server/config/paths");

/**
 * EduMate — Safe External Data Migration Script
 * 
 * Safely copies all existing local data, model weights, and llama.cpp binaries
 * from inside the repository to the external parent-level directories.
 */

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return 0;
    let count = 0;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            const srcPath = path.join(src, entry);
            const destPath = path.join(dest, entry);
            count += copyRecursiveSync(srcPath, destPath);
        }
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        // Only copy if destination doesn't exist or size differs
        if (!fs.existsSync(dest) || fs.statSync(dest).size !== stats.size) {
            fs.copyFileSync(src, dest);
            count++;
        }
    }
    return count;
}

function removeRecursiveSync(targetPath) {
    if (!fs.existsSync(targetPath)) return;
    try {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } catch (err) {
        console.warn(`[Cleanup] Could not remove ${targetPath}:`, err.message);
    }
}

async function runMigration() {
    console.log("=======================================================");
    console.log("🚚 EDUMATE EXTERNAL DATA MIGRATION");
    console.log("=======================================================");

    // 1. Ensure external directories exist
    paths.ensureAllDirectories();
    console.log("✓ Verified external directories exist:\n", JSON.stringify(paths.getAllPaths(), null, 2));

    const repoRoot = paths.REPO_ROOT;

    // 2. Migrate llama.cpp binaries
    const internalLlamaDir = path.join(repoRoot, "llama.cpp");
    if (fs.existsSync(internalLlamaDir)) {
        console.log(`\n📦 Migrating llama.cpp binaries to: ${paths.LLAMA_CPP_DIR}...`);
        const copied = copyRecursiveSync(internalLlamaDir, paths.LLAMA_CPP_DIR);
        console.log(`  ✓ Copied ${copied} files to ${paths.LLAMA_CPP_DIR}`);
    }

    // 3. Migrate GGUF Models
    const internalModelsDirs = [
        path.join(repoRoot, "server", "ai", "ai-models"),
        path.join(repoRoot, "models"),
        path.join(repoRoot, "backend", "ai-models")
    ];

    for (const mDir of internalModelsDirs) {
        if (fs.existsSync(mDir)) {
            const files = fs.readdirSync(mDir);
            for (const f of files) {
                if (f.endsWith(".gguf") || f.endsWith(".bin")) {
                    const src = path.join(mDir, f);
                    const dest = path.join(paths.MODELS_DIR, f);
                    console.log(`📦 Migrating model: ${f} -> ${paths.MODELS_DIR}...`);
                    copyRecursiveSync(src, dest);
                    console.log(`  ✓ Successfully migrated ${f}`);
                }
            }
        }
    }

    // 4. Migrate Storage (file_explorer, uploaded docs, chunks, cache)
    const internalStorage = path.join(repoRoot, "storage");
    if (fs.existsSync(internalStorage)) {
        console.log(`\n📦 Migrating storage to: ${paths.STORAGE_ROOT}...`);
        
        // Migrate file_explorer documents
        const internalExplorer = path.join(internalStorage, "file_explorer");
        if (fs.existsSync(internalExplorer)) {
            const copied = copyRecursiveSync(internalExplorer, paths.FILE_EXPLORER_DIR);
            console.log(`  ✓ Migrated ${copied} explorer documents to ${paths.FILE_EXPLORER_DIR}`);
        }

        // Migrate other storage files (excluding chunks and cache)
        const entries = fs.readdirSync(internalStorage);
        for (const entry of entries) {
            if (entry === "chunks" || entry === "cache" || entry === "file_explorer" || entry === "temp" || entry === "backups") continue;
            const src = path.join(internalStorage, entry);
            const dest = path.join(paths.STORAGE_ROOT, entry);
            copyRecursiveSync(src, dest);
        }

        // Migrate chunks
        const internalChunks = path.join(internalStorage, "chunks");
        if (fs.existsSync(internalChunks)) {
            const copied = copyRecursiveSync(internalChunks, paths.CHUNKS_ROOT);
            console.log(`  ✓ Migrated ${copied} chunk files to ${paths.CHUNKS_ROOT}`);
        }

        // Migrate cache
        const internalCache = path.join(internalStorage, "cache");
        if (fs.existsSync(internalCache)) {
            const copied = copyRecursiveSync(internalCache, paths.CACHE_ROOT);
            console.log(`  ✓ Migrated ${copied} cache files to ${paths.CACHE_ROOT}`);
        }

        // Migrate backups if any
        const internalBackups = path.join(internalStorage, "backups");
        if (fs.existsSync(internalBackups)) {
            const copied = copyRecursiveSync(internalBackups, paths.BACKUP_ROOT);
            console.log(`  ✓ Migrated ${copied} backup files to ${paths.BACKUP_ROOT}`);
        }
    }

    // 5. Migrate root chunks or cache if present
    const rootChunks = path.join(repoRoot, "chunks");
    if (fs.existsSync(rootChunks)) {
        copyRecursiveSync(rootChunks, paths.CHUNKS_ROOT);
    }
    const rootCache = path.join(repoRoot, ".cache");
    if (fs.existsSync(rootCache)) {
        copyRecursiveSync(rootCache, paths.CACHE_ROOT);
    }
    const rootSmartCache = path.join(repoRoot, ".smart_cache");
    if (fs.existsSync(rootSmartCache)) {
        copyRecursiveSync(rootSmartCache, paths.CACHE_ROOT);
    }

    // 6. Migrate logs
    const internalLogs = path.join(repoRoot, "logs");
    if (fs.existsSync(internalLogs)) {
        const copied = copyRecursiveSync(internalLogs, paths.LOG_ROOT);
        console.log(`  ✓ Migrated ${copied} log files to ${paths.LOG_ROOT}`);
    }

    console.log("\n=======================================================");
    console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=======================================================\n");
}

if (require.main === module) {
    runMigration().catch(err => {
        console.error("Migration error:", err);
        process.exit(1);
    });
}

module.exports = { runMigration, copyRecursiveSync, removeRecursiveSync };
