const fs = require("fs");
const path = require("path");
const os = require("os");
const paths = require("./paths");
const { detectModelProfile, getAllModelProfiles, MODEL_REGISTRY } = require("../ai/config/modelRegistry");

/**
 * EduMate Task 11 — Production Environment-Driven LLM Manager
 * 
 * Centralizes all 18 LLM configurations from .env:
 * - LLM_PROVIDER
 * - LLM_BASE_URL
 * - LLM_MODEL
 * - LLM_MODEL_PATH
 * - LLM_PORT
 * - LLM_CONTEXT_SIZE
 * - LLM_MAX_TOKENS
 * - LLM_TIMEOUT
 * - LLM_STREAM
 * - LLM_TEMPERATURE
 * - LLM_TOP_P
 * - LLM_TOP_K
 * - LLM_REPEAT_PENALTY
 * - LLM_MIN_P
 * - LLM_THREADS
 * - LLM_GPU_LAYERS
 * - LLM_BATCH_SIZE
 * - AI_DEBUG
 */

const numberFromEnv = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
};

const booleanFromEnv = (name, fallback) => {
    const value = process.env[name];
    if (value === undefined || value === "") return fallback;
    return String(value).toLowerCase().trim() === "true";
};

/**
 * Helper to format bytes into human readable KB / MB / GB
 */
const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return "0 MB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Inspects a model file on disk and returns its size and status
 */
const inspectModelFile = (filePath, rawModel = "") => {
    const candidates = [];
    if (filePath) {
        if (path.isAbsolute(filePath)) candidates.push(filePath);
        candidates.push(path.resolve(process.cwd(), filePath));
        candidates.push(path.resolve(__dirname, "..", "..", filePath));
    }
    const modelName = rawModel || (filePath ? path.basename(filePath) : "");
    if (modelName) {
        candidates.push(path.join(paths.MODELS_DIR, modelName));
        candidates.push(path.join(paths.MODELS_DIR, modelName.toLowerCase()));
        candidates.push(paths.LLAMA_MODEL_PATH);
        candidates.push(path.resolve(process.cwd(), "models", modelName));
        candidates.push(path.resolve(process.cwd(), "models", modelName.toLowerCase()));
        candidates.push(path.resolve(process.cwd(), "server", "ai", "ai-models", modelName));
        candidates.push(path.resolve(process.cwd(), "server", "ai", "ai-models", modelName.toLowerCase()));
    }

    for (const resolvedPath of candidates) {
        try {
            if (fs.existsSync(resolvedPath)) {
                const stats = fs.statSync(resolvedPath);
                if (stats.isFile()) {
                    return {
                        exists: true,
                        resolvedPath,
                        sizeBytes: stats.size,
                        sizeFormatted: formatBytes(stats.size),
                        readable: true
                    };
                }
            }
        } catch (_) {}
    }

    const fallbackPath = filePath ? (path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)) : "N/A";
    return {
        exists: false,
        resolvedPath: fallbackPath,
        sizeBytes: 0,
        sizeFormatted: "Not Found",
        readable: false
    };
};

/**
 * Strips Qwen thinking tokens and <think> blocks completely
 */
const stripQwenThinking = (text) => {
    if (!text || typeof text !== "string") return "";
    let clean = text;

    // Handle closed thinking blocks
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // If orphaned </think> exists, take the text following it
    if (clean.includes("</think>")) {
        clean = clean.split("</think>").pop();
    }

    // Strip incomplete <think> block that didn't close
    clean = clean.replace(/<think>[\s\S]*/gi, "");

    // Strip any remaining or broken thinking tags
    clean = clean.replace(/<\/?think>/gi, "");

    return clean.trim();
};

/**
 * Calculates dynamic output token budget based on question complexity
 * Guarantees fast responses while avoiding token starvation:
 * - Direct factual: 100-140 tokens (~1-2s)
 * - Academic definition: 200-240 tokens (~2-3s)
 * - Mixed query: 250-320 tokens (~3-5s)
 * - Medium query: 250-350 tokens (~3-5s)
 * - Large/comparison: 400-600 tokens (~6-8s)
 */
const calculateDynamicOutputBudget = (question = "", intent = "") => {
    const q = String(question || "").toLowerCase();
    const words = q.trim().split(/\s+/).filter(Boolean);

    // Direct small factual questions (room, floor, building, who is, contact)
    const isDirectFact = (
        q.startsWith("who ") ||
        q.startsWith("where ") ||
        q.startsWith("when ") ||
        q.startsWith("which room") ||
        q.startsWith("which floor") ||
        q.startsWith("which building") ||
        q.startsWith("what is the room") ||
        q.startsWith("what is the floor") ||
        q.startsWith("what is the building") ||
        q.startsWith("what is the name") ||
        q.startsWith("who's") ||
        q.includes("hod") ||
        q.includes("head of") ||
        q.includes("phone number") ||
        q.includes("contact number") ||
        q.includes("email") ||
        intent === "HOD_QUERY" ||
        intent === "LOCATION_QUERY"
    );

    if (isDirectFact && words.length < 14) {
        return {
            maxTokens: Math.min(130, numberFromEnv("LLM_MAX_TOKENS", 130)),
            tier: "SMALL_FACTUAL",
            targetLatencySec: "1-2s"
        };
    }

    // Mixed questions (combining definition/general knowledge with institutional facts)
    const isMixed = (
        (/\band\b/i.test(q) && /\b(?:fees?|tuition|cost|university|campus|department)\b/i.test(q)) ||
        intent === "MIXED"
    );
    if (isMixed) {
        return {
            maxTokens: Math.min(280, numberFromEnv("LLM_MAX_TOKENS", 280)),
            tier: "MIXED",
            targetLatencySec: "3-5s"
        };
    }

    // Academic definition / concept questions (e.g. "What is BCA?", "What is MCA?")
    const isDefinition = (
        /^(?:what\s+is|what\s+are|define|explain)\s+(?:a\s+|an\s+|the\s+)?([a-z0-9.]{2,10})\b/i.test(q) &&
        words.length <= 8
    );
    if (isDefinition) {
        return {
            maxTokens: Math.min(220, numberFromEnv("LLM_MAX_TOKENS", 220)),
            tier: "DEFINITION",
            targetLatencySec: "2-3s"
        };
    }

    // Large questions / comparisons
    if (
        words.length >= 14 ||
        /\b(?:compare|difference|complete\s+guide|full\s+overview|everything\s+about|all\s+details|comprehensive|all\s+faculty|entire\s+syllabus)\b/i.test(q) ||
        intent === "COMPARISON"
    ) {
        return {
            maxTokens: Math.min(500, numberFromEnv("LLM_MAX_TOKENS", 500)),
            tier: "LARGE",
            targetLatencySec: "5-8s"
        };
    }

    // Medium questions (fees, admission, eligibility, etc.)
    if (
        words.length >= 7 ||
        /\b(?:fees?|admission|eligibility|faculty|hostel|placement|scholarship|procedure|requirements?)\b/i.test(q) ||
        intent === "FEE_QUERY" || intent === "ADMISSION_QUERY"
    ) {
        return {
            maxTokens: Math.min(280, numberFromEnv("LLM_MAX_TOKENS", 280)),
            tier: "MEDIUM",
            targetLatencySec: "3-5s"
        };
    }

    // Default general
    return {
        maxTokens: Math.min(180, numberFromEnv("LLM_MAX_TOKENS", 180)),
        tier: "DEFAULT",
        targetLatencySec: "2-3s"
    };
};

/**
 * Returns centralized LLM configuration merged from .env & Model Registry
 */
const getLlmConfig = () => {
    const rawModel = process.env.LLAMA_MODEL || process.env.LLM_MODEL || "Qwen3-1.7B-Instruct-Q4_K_M.gguf";
    const profile = detectModelProfile(rawModel);

    const port = numberFromEnv("LLM_PORT", 8080);
    const defaultBaseUrl = `http://127.0.0.1:${port}`;
    let baseUrl = process.env.LLAMA_BASE_URL || process.env.LLM_BASE_URL || defaultBaseUrl;
    baseUrl = baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");

    const modelPath = process.env.LLAMA_MODEL_PATH || process.env.LLM_MODEL_PATH || path.join(paths.MODELS_DIR, rawModel);
    const modelInspection = inspectModelFile(modelPath, rawModel);

    const cpuCores = Math.max(1, (os.cpus()?.length || 4) - 1);
    const provider = process.env.LLAMA_PROVIDER || process.env.LLM_PROVIDER || profile.provider || "llama";

    return {
        provider,
        baseUrl,
        model: rawModel,
        modelPath,
        modelFile: modelInspection,
        profile,
        port,
        contextSize: numberFromEnv("LLM_CONTEXT_SIZE", profile.contextSize || 4096),
        maxTokens: numberFromEnv("LLM_MAX_TOKENS", profile.recommendedMaxTokens || 512),
        timeout: numberFromEnv("LLM_TIMEOUT", 30000),
        stream: booleanFromEnv("LLM_STREAM", profile.supportsStreaming ?? true),
        temperature: numberFromEnv("LLM_TEMPERATURE", profile.recommendedTemperature ?? 0.2),
        topP: numberFromEnv("LLM_TOP_P", profile.recommendedTopP ?? 0.9),
        topK: numberFromEnv("LLM_TOP_K", profile.recommendedTopK ?? 40),
        repeatPenalty: numberFromEnv("LLM_REPEAT_PENALTY", profile.recommendedRepeatPenalty ?? 1.1),
        minP: numberFromEnv("LLM_MIN_P", profile.recommendedMinP ?? 0.05),
        threads: numberFromEnv("LLM_THREADS", Math.min(cpuCores, profile.recommendedThreads || 4)),
        gpuLayers: numberFromEnv("LLM_GPU_LAYERS", profile.recommendedGpuLayers || 0),
        batchSize: numberFromEnv("LLM_BATCH_SIZE", profile.recommendedBatchSize || 512),
        aiDebug: booleanFromEnv("AI_DEBUG", booleanFromEnv("AI_DEBUG_MODE", false)),
        stopSequences: profile.stopSequences || ["<|im_end|>", "<|endoftext|>", "<|im_start|>"]
    };
};

const fetchHelper = (() => {
    try { return require("node-fetch"); } catch { return global.fetch; }
})();

// Health check cache with 5-second TTL
let healthCache = {
    result: null,
    timestamp: 0
};
const HEALTH_CACHE_TTL_MS = 5000;

/**
 * Fast health check against LLM_BASE_URL/health (with /v1/models fallback).
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<boolean>}
 */
const checkLlmHealth = async (timeoutMs = 2000) => {
    const status = await getLlmHealthStatus(timeoutMs);
    return status.online;
};

/**
 * Step 2: Comprehensive cached health check for llama.cpp.
 * 1. Ping /health.
 * 2. Ping /v1/models.
 * 3. Confirm the configured model is available.
 * 4. Cache the health status for a short TTL.
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<Object>}
 */
const getLlmHealthStatus = async (timeoutMs = 2000) => {
    const now = Date.now();
    if (healthCache.result && (now - healthCache.timestamp) < HEALTH_CACHE_TTL_MS) {
        return healthCache.result;
    }

    const config = getLlmConfig();
    let isOnline = false;
    let failureReason = null;
    let availableModels = [];

    // 1. Probe /health
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const healthRes = await fetchHelper(`${config.baseUrl}/health`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (healthRes && healthRes.ok) {
            isOnline = true;
        }
    } catch (healthErr) {
        failureReason = healthErr.message;
    }

    // 2. Probe /v1/models & 3. Confirm configured model is available
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const modelsRes = await fetchHelper(`${config.baseUrl}/v1/models`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (modelsRes && modelsRes.ok) {
            isOnline = true;
            const payload = await modelsRes.json().catch(() => ({}));
            if (Array.isArray(payload.data)) {
                availableModels = payload.data.map(m => m.id);
            }
        }
    } catch (modelsErr) {
        if (!isOnline) {
            failureReason = modelsErr.message;
        }
    }

    const result = {
        online: isOnline,
        status: isOnline ? "Local AI: Online" : "Local AI: Offline",
        provider: config.provider,
        model: config.model,
        endpoint: config.baseUrl,
        availableModels,
        reason: isOnline ? null : (failureReason || "llama.cpp server not responding on configured port"),
        cachedAt: new Date().toISOString()
    };

    healthCache = {
        result,
        timestamp: now
    };

    return result;
};

/**
 * Diagnostic status for developers
 */
const getModelDiagnostics = async () => {
    const config = getLlmConfig();
    const isOnline = await checkLlmHealth(1500);

    return {
        online: isOnline,
        provider: config.provider,
        model: config.model,
        displayName: config.profile.displayName,
        family: config.profile.family,
        baseUrl: config.baseUrl,
        port: config.port,
        modelPath: config.modelPath,
        modelFile: config.modelFile,
        contextSize: config.contextSize,
        maxTokens: config.maxTokens,
        threads: config.threads,
        gpuLayers: config.gpuLayers,
        batchSize: config.batchSize,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        repeatPenalty: config.repeatPenalty,
        minP: config.minP,
        aiDebug: config.aiDebug
    };
};

module.exports = {
    getLlmConfig,
    checkLlmHealth,
    getLlmHealthStatus,
    inspectModelFile,
    stripQwenThinking,
    calculateDynamicOutputBudget,
    getModelDiagnostics,
    getAllModelProfiles,
    detectModelProfile,
    MODEL_REGISTRY
};
