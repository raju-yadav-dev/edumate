const fs = require("fs");
const path = require("path");

const paths = require("../config/paths");

// Single Source of Truth for Knowledge Storage Root: external edumate-data/storage/
const STORAGE_ROOT = paths.STORAGE_ROOT;
const FILE_EXPLORER_DIR = paths.FILE_EXPLORER_DIR;

const DEFAULT_FOLDERS = [
    "academics",
    "admissions",
    "fees",
    "hostel",
    "general",
    "file_explorer"
];

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
    ".pdf",
    ".docx",
    ".doc",
    ".txt",
    ".md",
    ".markdown",
    ".pptx",
    ".ppt",
    ".xlsx",
    ".xls",
    ".ods",
    ".csv",
    ".html",
    ".htm",
    ".json",
    ".png",
    ".jpg",
    ".jpeg",
    ".jfif",
    ".jpe",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
    ".xml",
    ".zip"
]);

const IGNORED_DIRECTORIES = new Set([
    ".data",
    "data",
    "cache",
    "temp",
    "backups",
    "chunks",
    ".chunks",
    "embeddings",
    ".cache",
    ".smart_cache",
    ".git",
    "node_modules",
    ".gemini",
    "scratch"
]);

const IGNORED_FILE_EXTENSIONS = new Set([
    ".tmp",
    ".log",
    ".gguf",
    ".bin",
    ".traineddata",
    ".bak",
    ".old"
]);

const formatBytes = (bytes = 0) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};

/**
 * Checks whether a directory should be skipped by storage scanners
 */
function isIgnoredDirectory(dirName) {
    if (!dirName) return true;
    const clean = dirName.toLowerCase().trim();
    if (clean.startsWith(".")) return true;
    if (IGNORED_DIRECTORIES.has(clean)) return true;
    return false;
}

/**
 * Checks whether a file is an internal/cache/generated artifact that should never be ingested
 */
function isIgnoredFile(fileName) {
    if (!fileName) return true;
    const clean = fileName.toLowerCase().trim();
    if (clean.startsWith(".")) return true;
    if (clean === ".ds_store" || clean === "thumbs.db") return true;
    if (clean.endsWith(".cache.json") || clean.endsWith(".chunks.json")) return true;

    const ext = path.extname(clean);
    if (IGNORED_FILE_EXTENSIONS.has(ext)) return true;

    return false;
}

/**
 * Checks whether a file is a valid supported knowledge document
 */
function isSupportedDocument(fileName) {
    if (!fileName) return false;
    if (isIgnoredFile(fileName)) return false;
    const ext = path.extname(fileName).toLowerCase();
    return SUPPORTED_DOCUMENT_EXTENSIONS.has(ext);
}

/**
 * Ensures that STORAGE_ROOT and FILE_EXPLORER_DIR exist.
 * Automatically creates 'file_explorer' folder whenever missing.
 */
function ensureStorageRoot() {
    if (!fs.existsSync(STORAGE_ROOT)) {
        try { fs.mkdirSync(STORAGE_ROOT, { recursive: true }); } catch (_) {}
    }
    if (!fs.existsSync(FILE_EXPLORER_DIR)) {
        try { fs.mkdirSync(FILE_EXPLORER_DIR, { recursive: true }); } catch (_) {}
    }
    return STORAGE_ROOT;
}

// Automatically ensure root and file_explorer folder on module load
ensureStorageRoot();

/**
 * Resolves a safe absolute path inside FILE_EXPLORER_DIR or STORAGE_ROOT, preventing path traversal.
 */
function resolveSafePath(relativePath = "", fallbackName = "") {
    ensureStorageRoot();
    const cleanRelative = String(relativePath || "")
        .replace(/^[/\\]+/, "")
        .replace(/\.\./g, "");

    // Path with any leading redundant storage/ or file_explorer/ stripped
    const strippedFe = cleanRelative
        .replace(/^(edumate[/\\])?storage[/\\]file_explorer[/\\]?/i, "")
        .replace(/^(edumate[/\\])?storage[/\\]?/i, "")
        .replace(/^file_explorer[/\\]?/i, "");

    // 1. Direct path inside file_explorer with stripped relative
    const feStrippedPath = path.join(FILE_EXPLORER_DIR, strippedFe);
    if (fs.existsSync(feStrippedPath)) {
        return feStrippedPath;
    }

    // 2. Direct path inside file_explorer with original relative
    const fePath = path.join(FILE_EXPLORER_DIR, cleanRelative);
    if (fs.existsSync(fePath)) {
        return fePath;
    }

    // 3. Direct path inside STORAGE_ROOT
    const directPath = path.join(STORAGE_ROOT, cleanRelative);
    if (fs.existsSync(directPath)) {
        return directPath;
    }

    // 4. Try suffix segments (e.g. 'Admissions/course_eligibility/file.pdf' -> 'course_eligibility/file.pdf')
    const segments = cleanRelative.split(/[/\\]/);
    for (let i = 1; i < segments.length; i++) {
        const subRelative = segments.slice(i).join("/");
        const subFePath = path.join(FILE_EXPLORER_DIR, subRelative);
        if (fs.existsSync(subFePath)) {
            return subFePath;
        }
        const subStoragePath = path.join(STORAGE_ROOT, subRelative);
        if (fs.existsSync(subStoragePath)) {
            return subStoragePath;
        }
    }

    // 5. Basename lookup anywhere inside FILE_EXPLORER_DIR or STORAGE_ROOT
    const targetName = fallbackName || path.basename(cleanRelative);
    if (targetName && targetName !== "." && targetName !== "") {
        const findByBasename = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
                        return full;
                    }
                    if (entry.isDirectory() && !isIgnoredDirectory(entry.name)) {
                        const found = findByBasename(full);
                        if (found) return found;
                    }
                }
            } catch (_) {}
            return null;
        };

        const foundInFe = findByBasename(FILE_EXPLORER_DIR);
        if (foundInFe) return foundInFe;
        const foundInStorage = findByBasename(STORAGE_ROOT);
        if (foundInStorage) return foundInStorage;
    }

    // Default fallback: resolve inside FILE_EXPLORER_DIR
    return feStrippedPath;
}

/**
 * Dynamically gets available storage categories/folders from FILE_EXPLORER_DIR
 */
function getStorageCategories() {
    ensureStorageRoot();
    const categories = [];
    try {
        const entries = fs.readdirSync(FILE_EXPLORER_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !isIgnoredDirectory(entry.name)) {
                categories.push(entry.name);
            }
        }
    } catch (_) {}

    if (categories.length === 0) {
        categories.push("general");
    }

    return categories.sort();
}

/**
 * Strict Recursive Storage Scanner (Mission 15.1)
 * Scans only supported document types inside edumate/storage/file_explorer/.
 */
function scanKnowledgeDocuments(dir = FILE_EXPLORER_DIR, rootDir = dir) {
    ensureStorageRoot();
    const effectiveDir = dir;
    const effectiveRootDir = rootDir;
    const supportedFiles = [];
    const ignoredFiles = [];

    if (!fs.existsSync(effectiveDir)) {
        return { supportedFiles, ignoredFiles };
    }

    const walk = (currentDir) => {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (_) {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(effectiveRootDir, fullPath).replace(/\\/g, "/");

            if (entry.isDirectory()) {
                if (isIgnoredDirectory(entry.name)) {
                    ignoredFiles.push({ path: relPath, reason: "Ignored directory", fullPath });
                    continue;
                }
                walk(fullPath);
            } else if (entry.isFile()) {
                if (isIgnoredFile(entry.name)) {
                    ignoredFiles.push({ path: relPath, name: entry.name, reason: "Ignored file artifact", fullPath });
                    continue;
                }

                if (!isSupportedDocument(entry.name)) {
                    ignoredFiles.push({ path: relPath, name: entry.name, reason: "Unsupported file extension", fullPath });
                    continue;
                }

                try {
                    const stat = fs.statSync(fullPath);
                    const ext = path.extname(entry.name).toLowerCase();
                    supportedFiles.push({
                        fullPath,
                        relPath,
                        fileName: entry.name,
                        extension: ext,
                        size: stat.size,
                        mtime: stat.mtime
                    });
                } catch (_) {}
            }
        }
    };

    walk(effectiveDir);
    return { supportedFiles, ignoredFiles };
}

/**
 * Recursively computes storage metrics for edumate/storage/file_explorer/.
 */
function getLocalStorageStats(force = false) {
    ensureStorageRoot();

    let totalBytes = 0;
    let fileCount = 0;
    let folderCount = 0;
    let supportedCount = 0;
    let ignoredCount = 0;
    let largestFile = null;

    const statsRoot = FILE_EXPLORER_DIR;

    function walkDir(currentDir, relativePrefix = "") {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                if (isIgnoredDirectory(entry.name)) {
                    continue;
                }
                folderCount++;
                walkDir(fullPath, relPath);
            } else if (entry.isFile()) {
                if (isIgnoredFile(entry.name)) {
                    ignoredCount++;
                    continue;
                }

                try {
                    const stats = fs.statSync(fullPath);
                    totalBytes += stats.size;
                    fileCount++;

                    if (isSupportedDocument(entry.name)) {
                        supportedCount++;
                    } else {
                        ignoredCount++;
                    }

                    if (!largestFile || stats.size > largestFile.size) {
                        largestFile = {
                            name: entry.name,
                            path: relPath,
                            size: stats.size,
                            formatted: formatBytes(stats.size)
                        };
                    }
                } catch {
                    // Ignore stat errors for deleted temp files
                }
            }
        }
    }

    walkDir(statsRoot);

    // Compute total physical disk bytes across entire edumate/storage root (including chunks & explorer)
    let totalStorageBytes = 0;
    function computeStorageDirBytes(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    computeStorageDirBytes(fullPath);
                } else if (entry.isFile()) {
                    try {
                        const s = fs.statSync(fullPath);
                        totalStorageBytes += s.size;
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }
    computeStorageDirBytes(STORAGE_ROOT);

    const effectiveUsedBytes = totalStorageBytes > 0 ? totalStorageBytes : totalBytes;

    // Get real filesystem disk capacity and free space
    let diskTotal = 50 * 1024 * 1024 * 1024; // 50 GB default fallback
    let diskFree = 25 * 1024 * 1024 * 1024;

    try {
        if (typeof fs.statfsSync === "function") {
            const fsStats = fs.statfsSync(STORAGE_ROOT);
            diskTotal = Number(fsStats.blocks) * Number(fsStats.bsize);
            diskFree = Number(fsStats.bfree) * Number(fsStats.bsize);
        }
    } catch {
        // Fallback to configured quota
    }

    const quota = diskTotal;
    const remaining = diskFree;
    const usage = quota > 0 ? Number(((effectiveUsedBytes / quota) * 100).toFixed(1)) : 0;
    const averageFileSize = fileCount > 0 ? Math.round(totalBytes / fileCount) : 0;

    return {
        configured: true,
        connected: true,
        rootPath: STORAGE_ROOT,
        fileExplorerPath: FILE_EXPLORER_DIR,
        files: fileCount,
        folders: folderCount,
        supportedDocuments: supportedCount,
        ignoredFiles: ignoredCount,
        used: effectiveUsedBytes,
        fileExplorerUsedBytes: totalBytes,
        quota,
        remaining,
        usage,
        averageFileSize,
        largestFile,
        usedFormatted: formatBytes(effectiveUsedBytes),
        fileExplorerUsedFormatted: formatBytes(totalBytes),
        quotaFormatted: formatBytes(quota),
        remainingFormatted: formatBytes(remaining),
        averageFileSizeFormatted: formatBytes(averageFileSize)
    };
}

/**
 * Saves a file buffer to local storage.
 */
async function saveFile(relativePath, buffer) {
    ensureStorageRoot();
    const destPath = resolveSafePath(relativePath);
    const parentDir = path.dirname(destPath);

    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(destPath, buffer);
    return destPath;
}

/**
 * Reads a file from local storage as Buffer.
 */
async function readFile(relativePath) {
    const targetPath = resolveSafePath(relativePath);
    if (!fs.existsSync(targetPath)) {
        const err = new Error(`File not found in local storage: ${relativePath}`);
        err.statusCode = 404;
        throw err;
    }
    return fs.promises.readFile(targetPath);
}

/**
 * Checks if a file exists in local storage.
 */
function fileExists(relativePath) {
    const targetPath = resolveSafePath(relativePath);
    return fs.existsSync(targetPath);
}

/**
 * Deletes a file from local storage.
 */
async function deleteFile(relativePath) {
    const targetPath = resolveSafePath(relativePath);
    if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
    }
    return false;
}

/**
 * Moves or renames a file / directory in local storage.
 */
async function moveFile(sourceRelative, targetRelative) {
    const sourcePath = resolveSafePath(sourceRelative);
    const targetPath = resolveSafePath(targetRelative);

    if (!fs.existsSync(sourcePath)) {
        const err = new Error(`Source file not found: ${sourceRelative}`);
        err.statusCode = 404;
        throw err;
    }

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    await fs.promises.rename(sourcePath, targetPath);
    return targetPath;
}

/**
 * Copies a file in local storage.
 */
async function copyFile(sourceRelative, targetRelative) {
    const sourcePath = resolveSafePath(sourceRelative);
    const targetPath = resolveSafePath(targetRelative);

    if (!fs.existsSync(sourcePath)) {
        const err = new Error(`Source file not found: ${sourceRelative}`);
        err.statusCode = 404;
        throw err;
    }

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    await fs.promises.copyFile(sourcePath, targetPath);
    return targetPath;
}

/**
 * Creates a folder in local storage.
 */
async function createFolder(folderRelative) {
    const folderPath = resolveSafePath(folderRelative);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    return folderPath;
}

/**
 * Deletes a directory in local storage recursively.
 */
async function deleteFolder(folderRelative) {
    const folderPath = resolveSafePath(folderRelative);
    if (fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
        return true;
    }
    return false;
}

module.exports = {
    STORAGE_ROOT,
    FILE_EXPLORER_DIR,
    DEFAULT_FOLDERS,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    IGNORED_DIRECTORIES,
    IGNORED_FILE_EXTENSIONS,
    isIgnoredDirectory,
    isIgnoredFile,
    isSupportedDocument,
    scanKnowledgeDocuments,
    ensureStorageRoot,
    resolveSafePath,
    getLocalStorageStats,
    saveFile,
    readFile,
    fileExists,
    deleteFile,
    moveFile,
    copyFile,
    createFolder,
    deleteFolder,
    getStorageCategories,
    formatBytes
};
