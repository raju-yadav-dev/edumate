const path = require("path");
const fs = require("fs");

/**
 * EduMate — Unified External & Runtime Path Configuration
 * 
 * Rules:
 * 1. NO runtime-generated, downloaded, AI-model, cache, temporary, database,
 *    vector, log, or user-uploaded files are stored inside any directory tracked by Git.
 * 2. External resources default to the parent directory of the EduMate Git repository:
 *    <PARENT_DIR>/
 *    ├── edumate/                  ← Git repository
 *    ├── llama.cpp/                ← Local runtime binary (outside repo)
 *    │   └── llama-server.exe
 *    ├── models/                   ← Local AI models (outside repo)
 *    │   └── qwen3-1.7b-instruct-q4_k_m.gguf
 *    └── edumate-data/             ← Local runtime & user data (outside repo)
 *        ├── storage/              ← User knowledge files (file_explorer/)
 *        ├── chunks/               ← Local document JSON chunks
 *        ├── embeddings/           ← Vector/embeddings local artifacts
 *        ├── cache/                ← Multi-layer persistent disk caches
 *        ├── logs/                 ← Structured service log files
 *        ├── backups/              ← HMAC-signed database & system backups
 *        └── temp/                 ← Temporary staging files
 * 3. All paths can be overridden via environment variables.
 */

// Git Repository Root
const REPO_ROOT = path.resolve(__dirname, "../..");
// Parent directory containing the git repository and external siblings
const PARENT_DIR = path.resolve(REPO_ROOT, "..");

// --- 1. Local AI Runtime (llama.cpp) ---
const LLAMA_CPP_DIR = process.env.LLAMA_CPP_DIR || path.join(PARENT_DIR, "llama.cpp");
const LLAMA_CPP_PATH = process.env.LLAMA_CPP_PATH || path.join(
    LLAMA_CPP_DIR,
    process.platform === "win32" ? "llama-server.exe" : "llama-server"
);

// --- 2. Local AI Models ---
const MODELS_DIR = process.env.MODELS_DIR || process.env.LLAMA_MODELS_DIR || path.join(PARENT_DIR, "models");
const defaultModelName = process.env.LLM_MODEL || process.env.LLAMA_MODEL || "qwen3-1.7b-instruct-q4_k_m.gguf";
const LLAMA_MODEL_PATH = process.env.LLAMA_MODEL_PATH || process.env.LLM_MODEL_PATH || path.join(MODELS_DIR, defaultModelName);

// --- 3. External Data Root & Subsystems ---
const DATA_ROOT = process.env.EDUMATE_DATA_ROOT || path.join(PARENT_DIR, "edumate-data");

const STORAGE_ROOT = process.env.EDUMATE_STORAGE_ROOT || path.join(DATA_ROOT, "storage");
const FILE_EXPLORER_DIR = path.join(STORAGE_ROOT, "file_explorer");

const CHUNKS_ROOT = process.env.EDUMATE_CHUNKS_ROOT || path.join(DATA_ROOT, "chunks");
const EMBEDDINGS_ROOT = process.env.EDUMATE_EMBEDDINGS_ROOT || path.join(DATA_ROOT, "embeddings");
const CACHE_ROOT = process.env.EDUMATE_CACHE_ROOT || path.join(DATA_ROOT, "cache");
const LOG_ROOT = process.env.EDUMATE_LOG_ROOT || path.join(DATA_ROOT, "logs");
const BACKUP_ROOT = process.env.EDUMATE_BACKUP_ROOT || path.join(DATA_ROOT, "backups");
const TEMP_ROOT = process.env.EDUMATE_TEMP_ROOT || path.join(DATA_ROOT, "temp");

/**
 * Ensures all external directories exist on disk.
 */
function ensureAllDirectories() {
    const dirs = [
        LLAMA_CPP_DIR,
        MODELS_DIR,
        DATA_ROOT,
        STORAGE_ROOT,
        FILE_EXPLORER_DIR,
        CHUNKS_ROOT,
        EMBEDDINGS_ROOT,
        CACHE_ROOT,
        LOG_ROOT,
        BACKUP_ROOT,
        TEMP_ROOT
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
    ensureAllDirectories,
    getAllPaths
};
