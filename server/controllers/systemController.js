const mongoose = require("mongoose");
const taskRegistry = require("../utils/taskRegistry");
const Document = require("../models/Document");
const { withTimeoutAndRetry } = require("../utils/fetchHelper");

const getSystemHealth = async (req, res) => {
    // 1. MongoDB Status
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    // 2. Qdrant Status
    let qdrantStatus = "disconnected";
    try {
        const { client } = require("../ai/config/qdrant");
        // Simple probe with 3s timeout
        await withTimeoutAndRetry(() => client.getCollections(), 3000, 1, 0, "Qdrant health check");
        qdrantStatus = "connected";
    } catch (e) {
        console.error("Health check Qdrant probe failed:", e.message);
    }

    // 3. OCR Status (Gemini API Configuration Check)
    const ocrStatus = process.env.GEMINI_API_KEY ? "configured" : "unconfigured";

    // 4. Embedding Provider
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || "jina";
    const embeddingStatus = process.env.JINA_API_KEY ? "configured" : "unconfigured";

    // 5. llama.cpp / Ollama Status
    let llamaStatus = "disconnected";
    const llamaUrl = process.env.LLAMA_CPP_URL || process.env.OLLAMA_BASE_URL || "http://localhost:8080";
    try {
        const fetch = (() => {
            try { return require("node-fetch"); } catch { return global.fetch; }
        })();
        // Quick fetch to verify connection with 3s timeout
        const probeRes = await Promise.race([
            fetch(llamaUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
        ]);
        if (probeRes.ok || probeRes.status < 500) {
            llamaStatus = "connected";
        }
    } catch (e) {
        // Fallback: check if Ollama or Groq is configured as provider
        if (process.env.LLM_PROVIDER === "groq" && process.env.GROQ_API_KEY) {
            llamaStatus = "connected (Groq API)";
        }
    }

    // 6. Queue Status
    const activeTasks = taskRegistry.getAllTasks();
    let pendingIndexDocs = 0;
    let processingIndexDocs = 0;
    try {
        pendingIndexDocs = await Document.countDocuments({ status: "active", embeddingStatus: "pending" });
        processingIndexDocs = await Document.countDocuments({ status: "active", embeddingStatus: "processing" });
    } catch (e) {}

    // 7. Memory Usage
    const memory = process.memoryUsage();
    const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    const systemInfo = {
        success: true,
        data: {
            services: {
                mongodb: mongoStatus,
                qdrant: qdrantStatus,
                ocr: ocrStatus,
                embeddingProvider: {
                    provider: embeddingProvider,
                    status: embeddingStatus
                },
                llamaCpp: llamaStatus
            },
            queue: {
                backgroundTasks: {
                    total: activeTasks.length,
                    pending: activeTasks.filter(t => t.status === "pending").length,
                    processing: activeTasks.filter(t => t.status === "processing").length,
                    completed: activeTasks.filter(t => t.status === "completed").length,
                    failed: activeTasks.filter(t => t.status === "failed").length,
                    tasks: activeTasks.slice(-10) // return last 10 tasks
                },
                indexingQueue: {
                    pending: pendingIndexDocs,
                    processing: processingIndexDocs
                }
            },
            memory: {
                rss: formatMB(memory.rss),
                heapTotal: formatMB(memory.heapTotal),
                heapUsed: formatMB(memory.heapUsed),
                external: formatMB(memory.external),
                heapPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + "%"
            },
            timestamp: new Date().toISOString()
        }
    };

    return res.status(200).json(systemInfo);
};

module.exports = {
    getSystemHealth
};
