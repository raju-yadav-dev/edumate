const path = require("path");
const fs = require("fs");

/**
 * EduMate — Unified Self-Contained Path Configuration
 * 
 * Rules:
 * 1. Storage is self-contained under `storage/` inside the repository.
 * 2. Operational data (chunks, cache, logs, temp) lives in `storage/.data/` (ignored by git).
 * 3. AI Models default to `server/ai-models/` inside the repository (ignored by git).
 * 4. All paths can be overridden via environment variables if desired.
 */

// Git Repository Root
const REPO_ROOT = path.resolve(__dirname, "../..");
const PARENT_DIR = path.resolve(REPO_ROOT, "..");

// --- 1. Local AI Runtime (llama.cpp) ---
const LLAMA_CPP_DIR = process.env.LLAMA_CPP_DIR || path.join(REPO_ROOT, "llama.cpp");
const LLAMA_CPP_PATH = process.env.LLAMA_CPP_PATH || path.join(
    LLAMA_CPP_DIR,
    process.platform === "win32" ? "llama-server.exe" : "llama-server"
);

// --- 2. Local AI Models ---
const MODELS_DIR = process.env.MODELS_DIR || process.env.LLAMA_MODELS_DIR || path.join(REPO_ROOT, "server", "ai-models");
const defaultModelName = process.env.LLM_MODEL || process.env.LLAMA_MODEL || "Qwen2.5-3B-Instruct-Q4_K_M.gguf";
const LLAMA_MODEL_PATH = process.env.LLAMA_MODEL_PATH || process.env.LLM_MODEL_PATH || path.join(MODELS_DIR, defaultModelName);

// --- 3. Self-Contained Storage Root & Categories ---
const STORAGE_ROOT = process.env.EDUMATE_STORAGE_ROOT || path.join(REPO_ROOT, "storage");
const FILE_EXPLORER_DIR = path.join(STORAGE_ROOT, "file_explorer");

// Runtime operational data (chunks, cache, logs, backups, temp)
const DATA_ROOT = process.env.EDUMATE_DATA_ROOT || path.join(STORAGE_ROOT, ".data");

const CHUNKS_ROOT = process.env.EDUMATE_CHUNKS_ROOT || path.join(DATA_ROOT, "chunks");
const EMBEDDINGS_ROOT = process.env.EDUMATE_EMBEDDINGS_ROOT || path.join(DATA_ROOT, "embeddings");
const CACHE_ROOT = process.env.EDUMATE_CACHE_ROOT || path.join(DATA_ROOT, "cache");
const LOG_ROOT = process.env.EDUMATE_LOG_ROOT || path.join(DATA_ROOT, "logs");
const BACKUP_ROOT = process.env.EDUMATE_BACKUP_ROOT || path.join(DATA_ROOT, "backups");
const TEMP_ROOT = process.env.EDUMATE_TEMP_ROOT || path.join(DATA_ROOT, "temp");

// Standard knowledge categories
const KNOWLEDGE_CATEGORIES = [
    "academics",
    "admissions",
    "fees",
    "hostel",
    "general"
];

/**
 * Ensures all internal and storage directories exist on disk.
 */
function ensureAllDirectories() {
    const dirs = [
        MODELS_DIR,
        STORAGE_ROOT,
        FILE_EXPLORER_DIR,
        DATA_ROOT,
        CHUNKS_ROOT,
        EMBEDDINGS_ROOT,
        CACHE_ROOT,
        LOG_ROOT,
        BACKUP_ROOT,
        TEMP_ROOT,
        ...KNOWLEDGE_CATEGORIES.map(cat => path.join(STORAGE_ROOT, cat))
    ];

    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (err) {
            console.warn(`[Paths] Warning creating directory ${dir}:`, err.message);
        }
    }
}

/**
 * Return summary map of all active paths
 */
function getAllPaths() {
    return {
        REPO_ROOT,
        PARENT_DIR,
        LLAMA_CPP_DIR,
        LLAMA_CPP_PATH,
        MODELS_DIR,
        LLAMA_MODEL_PATH,
        DATA_ROOT,
        STORAGE_ROOT,
        FILE_EXPLORER_DIR,
        CHUNKS_ROOT,
        EMBEDDINGS_ROOT,
        CACHE_ROOT,
        LOG_ROOT,
        BACKUP_ROOT,
        TEMP_ROOT
    };
}

module.exports = {
    REPO_ROOT,
    PARENT_DIR,
    LLAMA_CPP_DIR,
    LLAMA_CPP_PATH,
    MODELS_DIR,
    LLAMA_MODEL_PATH,
    DATA_ROOT,
    STORAGE_ROOT,
    FILE_EXPLORER_DIR,
    CHUNKS_ROOT,
    EMBEDDINGS_ROOT,
    CACHE_ROOT,
    LOG_ROOT,
    BACKUP_ROOT,
    TEMP_ROOT,
    KNOWLEDGE_CATEGORIES,
    ensureAllDirectories,
    getAllPaths
};
