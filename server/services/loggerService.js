const fs = require("fs");
const path = require("path");

const paths = require("../config/paths");

/**
 * EduMate Mission 12.5 — Production Logging Service
 * 
 * Manages structured rotating log files for:
 * - server (general requests, startup, errors)
 * - retrieval (Qdrant searches, scores, query rewrites)
 * - chunking (file uploads, parsing, tokenization)
 * - llama (LLM prompts, completions, tokens/sec)
 * - queue (background task status, retries)
 */

class LoggerService {
    constructor() {
        this.logDir = paths.LOG_ROOT;
        this._ensureLogDirectory();
        
        this.logStreams = {
            server: path.join(this.logDir, "server.log"),
            retrieval: path.join(this.logDir, "retrieval.log"),
            chunking: path.join(this.logDir, "chunking.log"),
            llama: path.join(this.logDir, "llama.log"),
            queue: path.join(this.logDir, "queue.log")
        };
    }

    _ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            try {
                fs.mkdirSync(this.logDir, { recursive: true });
            } catch (err) {
                console.warn("[LoggerService] Failed to create logs directory:", err.message);
            }
        }
    }

    _writeEntry(category, level, message, metadata = {}) {
        const filePath = this.logStreams[category] || this.logStreams.server;
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            category,
            level,
            message,
            ...metadata
        };

        const line = JSON.stringify(entry) + "\n";
        try {
            fs.appendFileSync(filePath, line, { encoding: "utf8" });
        } catch (_) {}
    }

    logServer(level, message, meta) {
        this._writeEntry("server", level, message, meta);
    }

    logRetrieval(level, message, meta) {
        this._writeEntry("retrieval", level, message, meta);
    }

    logChunking(level, message, meta) {
        this._writeEntry("chunking", level, message, meta);
    }

    logLlama(level, message, meta) {
        this._writeEntry("llama", level, message, meta);
    }

    logQueue(level, message, meta) {
        this._writeEntry("queue", level, message, meta);
    }
}

const loggerService = new LoggerService();

module.exports = loggerService;
