let mongoose;
try { mongoose = require("mongoose"); } catch { mongoose = { connection: { readyState: 0 } }; }

const { withTimeoutAndRetry } = require("../utils/fetchHelper");
const { checkLlmHealth, getLlmConfig } = require("../config/llm");
const taskRegistry = require("../utils/taskRegistry");
const { llmCircuitBreaker } = require("./circuitBreaker");
const performanceMonitoringService = require("./performanceMonitoringService");

let Document;
try { Document = require("../models/Document"); } catch { Document = { countDocuments: async () => 0 }; }

// Track timestamps of last successful check for each service
const lastSuccessfulChecks = {
    mongodb: null,
    qdrant: null,
    llamaCpp: null,
    storage: null,
    embedding: null
};

// In-Memory Cached Health Snapshot
let cachedHealthReport = null;
let lastCheckTime = 0;
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds
let backgroundIntervalHandle = null;

/**
 * Probes MongoDB connection and ping latency.
 */
const checkMongoHealth = async (timeoutMs = 2000) => {
    const start = Date.now();
    const readyState = mongoose?.connection?.readyState ?? 0;
    const isConnected = readyState === 1;

    if (!isConnected) {
        return {
            status: "disconnected",
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            lastSuccessfulCheck: lastSuccessfulChecks.mongodb,
            errorMessage: "MongoDB connection is not active",
            message: "MongoDB connection is not active"
        };
    }

    try {
        if (mongoose.connection.db) {
            await Promise.race([
                mongoose.connection.db.admin().ping(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("MongoDB ping timed out")), timeoutMs))
            ]);
        }
        const latency = Date.now() - start;
        lastSuccessfulChecks.mongodb = new Date().toISOString();
        return {
            status: "connected",
            latency,
            latencyMs: latency,
            readyState: 1,
            lastSuccessfulCheck: lastSuccessfulChecks.mongodb,
            errorMessage: null,
            message: "MongoDB operational"
        };
    } catch (err) {
        return {
            status: "degraded",
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            readyState,
            lastSuccessfulCheck: lastSuccessfulChecks.mongodb,
            errorMessage: err.message,
            message: err.message
        };
    }
};

/**
 * Probes Qdrant vector database connection and latency (with 2 retries on transient errors).
 */
const checkQdrantHealth = async (timeoutMs = 2000) => {
    const start = Date.now();
    try {
        const { client, collectionName } = require("../ai/config/qdrant");
        const res = await withTimeoutAndRetry(
            () => client.getCollections(),
            timeoutMs,
            1,
            200,
            "Qdrant health check"
        );
        const collections = res?.collections || [];
        const hasCollection = collections.some(c => c.name === collectionName);
        const latency = Date.now() - start;
        lastSuccessfulChecks.qdrant = new Date().toISOString();
        return {
            status: "connected",
            latency,
            latencyMs: latency,
            collectionName,
            hasCollection,
            collectionsCount: collections.length,
            lastSuccessfulCheck: lastSuccessfulChecks.qdrant,
            errorMessage: null,
            message: "Qdrant vector store operational"
        };
    } catch (err) {
        return {
            status: "disconnected",
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            lastSuccessfulCheck: lastSuccessfulChecks.qdrant,
            errorMessage: err.message || "Qdrant server unreachable",
            message: err.message || "Qdrant server unreachable"
        };
    }
};

/**
 * Probes llama.cpp / Local LLM connection and model status (with 1 retry).
 */
const checkLlamaCppHealth = async (timeoutMs = 2500) => {
    const start = Date.now();
    const config = getLlmConfig();
    try {
        const isHealthy = await checkLlmHealth(timeoutMs);
        const latency = Date.now() - start;
        if (isHealthy) {
            lastSuccessfulChecks.llamaCpp = new Date().toISOString();
            // Automatically recover circuit breaker when health check succeeds
            llmCircuitBreaker.reset();
            return {
                status: "connected",
                latency,
                latencyMs: latency,
                provider: config.provider,
                model: config.model,
                baseUrl: config.baseUrl,
                circuitBreaker: llmCircuitBreaker.getStatus(),
                lastSuccessfulCheck: lastSuccessfulChecks.llamaCpp,
                errorMessage: null,
                message: `Local LLM ready (${config.provider} - ${config.model})`
            };
        }
        return {
            status: "disconnected",
            latency,
            latencyMs: latency,
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            circuitBreaker: llmCircuitBreaker.getStatus(),
            lastSuccessfulCheck: lastSuccessfulChecks.llamaCpp,
            errorMessage: "Local AI model unavailable",
            message: "Local AI model unavailable"
        };
    } catch (err) {
        return {
            status: "disconnected",
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            circuitBreaker: llmCircuitBreaker.getStatus(),
            lastSuccessfulCheck: lastSuccessfulChecks.llamaCpp,
            errorMessage: err.message,
            message: err.message
        };
    }
};

/**
 * Probes Storage service (Local Storage Root).
 */
const checkStorageHealth = async (timeoutMs = 1000) => {
    const start = Date.now();
    try {
        const localStorageManager = require("../storage/localStorageManager");
        const root = localStorageManager.ensureStorageRoot();
        const stats = localStorageManager.getLocalStorageStats();
        const latency = Date.now() - start;
        lastSuccessfulChecks.storage = new Date().toISOString();

        return {
            status: "connected",
            type: "local",
            rootPath: stats.rootPath,
            usedBytes: stats.used,
            freeBytes: stats.free,
            files: stats.files,
            folders: stats.folders,
            latency,
            latencyMs: latency,
            lastSuccessfulCheck: lastSuccessfulChecks.storage,
            errorMessage: null,
            message: "Local storage root operational"
        };
    } catch (err) {
        return {
            status: "degraded",
            type: "local",
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            lastSuccessfulCheck: lastSuccessfulChecks.storage,
            errorMessage: err.message || "Local storage root inaccessible",
            message: err.message || "Local storage root inaccessible"
        };
    }
};

/**
 * Probes Embedding service (Jina / configured embedding provider).
 */
const checkEmbeddingHealth = async (timeoutMs = 5000) => {
    const start = Date.now();
    const provider = process.env.EMBEDDING_PROVIDER || "jina";
    const apiKey = process.env.JINA_API_KEY;

    if (!apiKey) {
        return {
            status: "disconnected",
            provider,
            dimension: 768,
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            lastSuccessfulCheck: lastSuccessfulChecks.embedding,
            errorMessage: "JINA_API_KEY is not configured",
            message: "Embedding API key not configured"
        };
    }

    try {
        const embeddings = require("../ai/config/embeddings");
        // Lightweight embedding probe
        const vector = await withTimeoutAndRetry(
            () => embeddings.embedText("ping", { task: "retrieval.query" }),
            timeoutMs,
            1,
            200,
            "Embedding health check"
        );
        const latency = Date.now() - start;
        if (Array.isArray(vector) && vector.length === 768) {
            lastSuccessfulChecks.embedding = new Date().toISOString();
            return {
                status: "connected",
                provider,
                dimension: vector.length,
                latency,
                latencyMs: latency,
                lastSuccessfulCheck: lastSuccessfulChecks.embedding,
                errorMessage: null,
                message: "Embedding service operational"
            };
        }
        return {
            status: "degraded",
            provider,
            latency,
            latencyMs: latency,
            lastSuccessfulCheck: lastSuccessfulChecks.embedding,
            errorMessage: "Embedding returned unexpected vector format",
            message: "Embedding dimension mismatch"
        };
    } catch (err) {
        return {
            status: "disconnected",
            provider,
            latency: Date.now() - start,
            latencyMs: Date.now() - start,
            lastSuccessfulCheck: lastSuccessfulChecks.embedding,
            errorMessage: err.message,
            message: err.message
        };
    }
};

/**
 * Formats uptime into human-readable string.
 */
const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
};

/**
 * Runs fresh health probes across all 5 key services.
 */
const runLiveHealthCheck = async () => {
    const [mongo, qdrant, llamaCpp, storage, embedding] = await Promise.all([
        checkMongoHealth(),
        checkQdrantHealth(),
        checkLlamaCppHealth(),
        checkStorageHealth(),
        checkEmbeddingHealth()
    ]);

    // Active Task Metrics
    const activeTasks = taskRegistry.getAllTasks();
    let pendingIndexDocs = 0;
    let processingIndexDocs = 0;
    try {
        if (mongo.status === "connected") {
            pendingIndexDocs = await Document.countDocuments({ status: "active", embeddingStatus: "pending" });
            processingIndexDocs = await Document.countDocuments({ status: "active", embeddingStatus: "processing" });
        }
    } catch (_) {}

    // Memory info
    const memory = process.memoryUsage();
    const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    // Telemetry averages
    const metrics = performanceMonitoringService.getMetricsSummary();

    // Overall Status Calculation
    const coreServices = [mongo, qdrant, llamaCpp, storage, embedding];
    const disconnectedCount = coreServices.filter(s => s.status === "disconnected").length;
    const degradedCount = coreServices.filter(s => s.status === "degraded").length;

    let overallStatus = "healthy";
    if (disconnectedCount > 0) {
        overallStatus = disconnectedCount >= 2 ? "unhealthy" : "degraded";
    } else if (degradedCount > 0) {
        overallStatus = "degraded";
    }

    const uptimeSec = Math.floor(process.uptime());

    const report = {
        success: true,
        overallStatus,
        status: overallStatus,
        uptime: uptimeSec,
        uptimeFormatted: formatUptime(uptimeSec),
        retrievalLatencyAverage: metrics.avgRetrievalLatencyMs || 0,
        llmLatencyAverage: metrics.avgLlmLatencyMs || 0,
        circuitBreaker: llmCircuitBreaker.getStatus(),
        serviceStatus: [
            { name: "mongodb", ...mongo },
            { name: "qdrant", ...qdrant },
            { name: "llamaCpp", ...llamaCpp },
            { name: "storage", ...storage },
            { name: "embedding", ...embedding }
        ],
        services: {
            mongodb: mongo,
            qdrant: qdrant,
            llamaCpp: llamaCpp,
            storage: storage,
            embedding: embedding
        },
        queueStatus: {
            backgroundTasks: {
                total: activeTasks.length,
                pending: activeTasks.filter(t => t.status === "pending").length,
                processing: activeTasks.filter(t => t.status === "processing").length,
                completed: activeTasks.filter(t => t.status === "completed").length,
                failed: activeTasks.filter(t => t.status === "failed").length,
                tasks: activeTasks.slice(-10)
            },
            indexingQueue: {
                pending: pendingIndexDocs,
                processing: processingIndexDocs
            }
        },
        queue: {
            backgroundTasks: {
                total: activeTasks.length,
                pending: activeTasks.filter(t => t.status === "pending").length,
                processing: activeTasks.filter(t => t.status === "processing").length,
                completed: activeTasks.filter(t => t.status === "completed").length,
                failed: activeTasks.filter(t => t.status === "failed").length,
                tasks: activeTasks.slice(-10)
            },
            indexingQueue: {
                pending: pendingIndexDocs,
                processing: processingIndexDocs
            }
        },
        memoryUsage: {
            rss: formatMB(memory.rss),
            heapTotal: formatMB(memory.heapTotal),
            heapUsed: formatMB(memory.heapUsed),
            external: formatMB(memory.external),
            heapPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + "%"
        },
        memory: {
            rss: formatMB(memory.rss),
            heapTotal: formatMB(memory.heapTotal),
            heapUsed: formatMB(memory.heapUsed),
            external: formatMB(memory.external),
            heapPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + "%"
        },
        timestamp: new Date().toISOString()
    };

    cachedHealthReport = report;
    lastCheckTime = Date.now();
    return report;
};

/**
 * Returns the cached health report if fresh (< 30s), or executes live check if expired/forced.
 * Ensures user requests never block on probing all remote services.
 */
const getSystemHealthReport = async ({ force = false } = {}) => {
    const isFresh = cachedHealthReport && (Date.now() - lastCheckTime < HEALTH_CACHE_TTL_MS);
    if (!force && isFresh) {
        return cachedHealthReport;
    }
    return runLiveHealthCheck();
};

/**
 * Starts background health monitoring timer running every 30 seconds.
 */
const startBackgroundHealthMonitoring = (intervalMs = 30000) => {
    if (backgroundIntervalHandle) return;
    
    // Initial run in background
    runLiveHealthCheck().catch(err => console.warn("[Health Service] Initial health check warning:", err.message));

    backgroundIntervalHandle = setInterval(() => {
        runLiveHealthCheck().catch(err => console.warn("[Health Service] Background health check error:", err.message));
    }, intervalMs);

    if (backgroundIntervalHandle.unref) {
        backgroundIntervalHandle.unref(); // Do not hold Node event loop open
    }
};

// Start background monitoring automatically
startBackgroundHealthMonitoring(30000);

module.exports = {
    checkMongoHealth,
    checkQdrantHealth,
    checkLlamaCppHealth,
    checkStorageHealth,
    checkEmbeddingHealth,
    getSystemHealthReport,
    runLiveHealthCheck,
    startBackgroundHealthMonitoring
};
