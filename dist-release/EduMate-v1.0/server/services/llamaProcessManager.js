const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getLlmConfig, checkLlmHealth, inspectModelFile } = require("../config/llm");

/**
 * EduMate Task 11.2 — Production llama.cpp Startup Manager, Health Check & Auto Recovery
 * 
 * Responsibilities:
 * - Read model configuration from .env via getLlmConfig()
 * - Verify executable and GGUF file existence before launching
 * - Port detection & reuse (Never start a second instance if one is already listening)
 * - Auto-restart on unexpected crashes (up to max 5 restarts with backoff)
 * - Health check poller with auto-reconnect
 * - Graceful shutdown hook (terminates child process ONLY if EduMate spawned it)
 */

class LlamaProcessManager {
    constructor() {
        this.process = null;
        this.startedByEduMate = false;
        this.existingServerReused = false;
        this.restartCount = 0;
        this.maxRestarts = Number(process.env.LLM_MAX_RESTARTS) || 5;
        this.isShuttingDown = false;
        this.lastStartTime = null;
        this.lastCrashTime = null;
        this.healthPollInterval = null;
        this.status = "stopped"; // "stopped", "starting", "running", "degraded", "reusing_external"

        // Register process termination handlers for graceful cleanup
        this._setupExitHooks();
    }

    /**
     * Resolve llama-server executable path
     */
    findExecutablePath() {
        const customPath = process.env.LLAMA_SERVER_PATH;
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }

        const candidatePaths = [
            path.resolve(process.cwd(), "llama.cpp", "llama-server.exe"),
            path.resolve(process.cwd(), "llama.cpp", "llama-server"),
            path.resolve(process.cwd(), "..", "llama.cpp", "llama-server.exe"),
            path.resolve(process.cwd(), "..", "llama.cpp", "llama-server"),
            path.resolve(__dirname, "..", "..", "llama.cpp", "llama-server.exe"),
            path.resolve(__dirname, "..", "..", "llama.cpp", "llama-server"),
            path.resolve(process.cwd(), "bin", "llama-server.exe"),
            path.resolve(process.cwd(), "bin", "llama-server"),
            path.resolve(process.cwd(), "llama-server.exe"),
            path.resolve(process.cwd(), "llama-server"),
            path.resolve(__dirname, "..", "..", "bin", "llama-server.exe"),
            path.resolve(__dirname, "..", "..", "llama-server.exe")
        ];

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) return p;
        }

        return null;
    }

    /**
     * Inspects health of configured server
     */
    async probeServerHealth(timeoutMs = 1500) {
        return await checkLlmHealth(timeoutMs);
    }

    /**
     * Starts or connects to the local llama.cpp server
     */
    async startServer({ silent = false } = {}) {
        if (this.status === "running" || this.status === "reusing_external") {
            return { success: true, status: this.status, reused: this.existingServerReused };
        }

        const config = getLlmConfig();

        // 1. Check if an instance is ALREADY running on the configured port
        const alreadyRunning = await this.probeServerHealth(1200);
        if (alreadyRunning) {
            this.startedByEduMate = false;
            this.existingServerReused = true;
            this.status = "reusing_external";
            if (!silent) {
                console.log(`[llama.cpp Manager] Detected active server on port ${config.port}. Reusing existing instance.`);
            }
            this._startHealthPoller();
            return { success: true, status: this.status, reused: true };
        }

        // 2. Validate GGUF Model file
        const modelInspection = inspectModelFile(config.modelPath);
        if (!modelInspection.exists) {
            const warnMsg = `[llama.cpp Manager] GGUF model file not found at: ${modelInspection.resolvedPath}`;
            console.warn(warnMsg);
            this.status = "degraded";
            return { success: false, error: warnMsg, code: "MODEL_NOT_FOUND" };
        }

        // 3. Find llama-server executable
        const exePath = this.findExecutablePath();
        if (!exePath) {
            const warnMsg = `[llama.cpp Manager] llama-server executable not found in ./bin or project root. Local auto-spawn disabled.`;
            console.warn(warnMsg);
            this.status = "degraded";
            return { success: false, error: warnMsg, code: "EXECUTABLE_NOT_FOUND" };
        }

        // 4. Construct launch arguments
        const args = [
            "-m", modelInspection.resolvedPath,
            "-c", String(config.contextSize),
            "--port", String(config.port),
            "-t", String(config.threads),
            "-ngl", String(config.gpuLayers),
            "-b", String(config.batchSize),
            "--host", "127.0.0.1"
        ];

        if (!silent) {
            console.log(`[llama.cpp Manager] Launching llama-server with ${config.model} (${modelInspection.sizeFormatted})...`);
            console.log(`[llama.cpp Manager] Executable: ${exePath}`);
            console.log(`[llama.cpp Manager] Flags: -c ${config.contextSize} -t ${config.threads} -ngl ${config.gpuLayers} -b ${config.batchSize} --port ${config.port}`);
        }

        this.status = "starting";
        this.isShuttingDown = false;
        this.lastStartTime = Date.now();

        try {
            this.process = spawn(exePath, args, {
                cwd: path.dirname(exePath),
                stdio: ["ignore", "pipe", "pipe"],
                detached: false
            });

            this.startedByEduMate = true;
            this.existingServerReused = false;

            this.process.stdout.on("data", (data) => {
                const str = data.toString();
                if (config.aiDebug) {
                    console.log(`[llama-server:out] ${str.trim()}`);
                }
            });

            this.process.stderr.on("data", (data) => {
                const str = data.toString();
                if (config.aiDebug || str.includes("error") || str.includes("failed")) {
                    console.warn(`[llama-server:err] ${str.trim()}`);
                }
            });

            this.process.on("error", (err) => {
                console.error(`[llama.cpp Manager] Failed to start child process:`, err.message);
                this.status = "degraded";
            });

            this.process.on("exit", (code, signal) => {
                this._handleProcessExit(code, signal);
            });

            // Wait for server to become responsive (up to 45 seconds for model loading)
            const isUp = await this._waitForHealthy(45000, 800);
            if (isUp) {
                this.status = "running";
                this.restartCount = 0; // Reset restart counter upon successful startup
                if (!silent) {
                    console.log(`[llama.cpp Manager] ✓ llama-server successfully started on port ${config.port} (PID: ${this.process.pid}).`);
                }
                this._startHealthPoller();
                return { success: true, status: "running", pid: this.process.pid };
            } else {
                this.status = "degraded";
                return { success: false, error: "Server started but failed health checks within timeout" };
            }
        } catch (spawnErr) {
            console.error(`[llama.cpp Manager] Spawn error:`, spawnErr.message);
            this.status = "degraded";
            return { success: false, error: spawnErr.message };
        }
    }

    /**
     * Polls until healthy or timeout
     */
    async _waitForHealthy(maxTimeoutMs = 45000, intervalMs = 800) {
        const start = Date.now();
        while (Date.now() - start < maxTimeoutMs) {
            const healthy = await this.probeServerHealth(1000);
            if (healthy) return true;
            await new Promise(r => setTimeout(r, intervalMs));
        }
        return false;
    }

    /**
     * Handle child process termination and trigger auto-restart if unexpected
     */
    _handleProcessExit(code, signal) {
        this.lastCrashTime = Date.now();
        const wasEduMate = this.startedByEduMate;
        this.process = null;
        this.startedByEduMate = false;

        if (this.isShuttingDown) {
            this.status = "stopped";
            return;
        }

        console.warn(`[llama.cpp Manager] Server process exited with code ${code}, signal ${signal}.`);

        if (wasEduMate && this.restartCount < this.maxRestarts) {
            this.restartCount++;
            const backoffMs = Math.min(1000 * Math.pow(2, this.restartCount - 1), 10000);
            console.log(`[llama.cpp Manager] Auto-recovering server (attempt ${this.restartCount}/${this.maxRestarts}) in ${backoffMs}ms...`);
            setTimeout(() => {
                this.startServer({ silent: false });
            }, backoffMs);
        } else {
            this.status = "degraded";
            console.error(`[llama.cpp Manager] Server stopped and auto-restart threshold reached (${this.maxRestarts}).`);
        }
    }

    /**
     * Starts lightweight background health checking
     */
    _startHealthPoller() {
        if (this.healthPollInterval) clearInterval(this.healthPollInterval);
        this.healthPollInterval = setInterval(async () => {
            const healthy = await this.probeServerHealth(1500);
            if (!healthy && (this.status === "running" || this.status === "reusing_external")) {
                console.warn(`[llama.cpp Manager] Background health check lost connection to server.`);
                this.status = "degraded";
            } else if (healthy && this.status === "degraded") {
                console.log(`[llama.cpp Manager] Background health check reconnected successfully.`);
                this.status = this.startedByEduMate ? "running" : "reusing_external";
            }
        }, 30000);

        if (this.healthPollInterval.unref) {
            this.healthPollInterval.unref();
        }
    }

    /**
     * Stop the server gracefully if started by EduMate
     */
    async stopServer() {
        this.isShuttingDown = true;
        if (this.healthPollInterval) {
            clearInterval(this.healthPollInterval);
            this.healthPollInterval = null;
        }

        if (this.process && this.startedByEduMate) {
            console.log(`[llama.cpp Manager] Stopping child llama-server process (PID: ${this.process.pid})...`);
            try {
                this.process.kill("SIGTERM");
                await new Promise(r => setTimeout(r, 1000));
                if (this.process && !this.process.killed) {
                    this.process.kill("SIGKILL");
                }
            } catch (err) {
                console.warn(`[llama.cpp Manager] Warning during process termination:`, err.message);
            }
            this.process = null;
            this.startedByEduMate = false;
        }

        this.status = "stopped";
        return { success: true };
    }

    /**
     * Clean exit hooks
     */
    _setupExitHooks() {
        const cleanup = () => {
            if (this.startedByEduMate && this.process) {
                try {
                    this.process.kill("SIGTERM");
                } catch (_) {}
            }
        };

        process.once("SIGINT", cleanup);
        process.once("SIGTERM", cleanup);
        process.once("exit", cleanup);
    }

    /**
     * Returns full status report
     */
    getStatus() {
        const config = getLlmConfig();
        return {
            status: this.status,
            startedByEduMate: this.startedByEduMate,
            existingServerReused: this.existingServerReused,
            pid: this.process?.pid || null,
            port: config.port,
            model: config.model,
            restartCount: this.restartCount,
            maxRestarts: this.maxRestarts,
            lastStartTime: this.lastStartTime ? new Date(this.lastStartTime).toISOString() : null,
            lastCrashTime: this.lastCrashTime ? new Date(this.lastCrashTime).toISOString() : null
        };
    }
}

const llamaProcessManager = new LlamaProcessManager();

module.exports = llamaProcessManager;
