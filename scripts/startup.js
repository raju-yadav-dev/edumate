/**
 * EduMate AI Platform — Master Development Startup Runtime
 * 
 * Command: npm run edumate (alias: npm run dev)
 * 
 * Orchestration Workflow:
 * 1. Environment & Pre-flight Diagnostics
 * 2. Storage System Initialization
 * 3. AI Runtime & Vector DB Health Probing
 * 4. Microservice Orchestration (Backend, Frontend, Knowledge Studio)
 * 5. Production Control Center Dashboard
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const rootPath = path.resolve(__dirname, "..");
const envPath = path.join(rootPath, ".env");

function loadEnvSafely(filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
        require("dotenv").config({ path: filePath });
    } catch {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            for (const line of content.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const idx = trimmed.indexOf("=");
                if (idx > 0) {
                    const key = trimmed.substring(0, idx).trim();
                    const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
                    if (process.env[key] === undefined) {
                        process.env[key] = val;
                    }
                }
            }
        } catch (_) {}
    }
}

const { verifyNodeVersion, verifyDependencies } = require("./dependencyChecker");

// Stage 0: Early dependency & Node verification
verifyNodeVersion();
verifyDependencies();

// Load environment after dependencies are verified
loadEnvSafely(envPath);

const logger = require("./logger");
const { verifyEnvironment } = require("./verifyEnvironment");
const { printBanner, printControlCenter } = require("./banner");

const isDebug = process.argv.includes("--debug") || process.env.DEBUG === "true";

function checkHttpService(url, timeoutMs = 1500) {
    return new Promise((resolve) => {
        try {
            const req = http.get(url, (res) => {
                resolve(res.statusCode < 500);
            });
            req.on("error", () => resolve(false));
            req.setTimeout(timeoutMs, () => {
                req.destroy();
                resolve(false);
            });
        } catch {
            resolve(false);
        }
    });
}

const startDev = async () => {
    printBanner();
    console.log(logger.cyan("🚀 Initializing EduMate AI Platform Development Ecosystem...\n"));

    // Stage 1: Pre-flight Verification
    const envOk = verifyEnvironment();
    if (!envOk) {
        logger.error("❌ Startup blocked: Environment variables are not configured correctly.");
        process.exit(1);
    }

    // Stage 2: Storage Root Verification
    let localStorageManager;
    try {
        localStorageManager = require("../server/storage/localStorageManager");
        localStorageManager.ensureStorageRoot();
    } catch (_) {}

    // Stage 3: Probe Infrastructure Services & Auto-boot Qdrant / Docker
    let isMongoConnected = true;
    try {
        const { verifyMongo } = require("./verifyMongo");
        isMongoConnected = await verifyMongo();
    } catch {
        isMongoConnected = false;
    }

    // Auto-launch Docker Desktop & Qdrant Container if needed
    try {
        const { startQdrantContainer } = require("./dockerManager");
        await startQdrantContainer();
    } catch (dockerErr) {
        console.log(logger.yellow(`  [Docker Auto-boot Notice] ${dockerErr.message}`));
    }

    let isQdrantConnected = true;
    try {
        const { verifyQdrant } = require("./verifyQdrant");
        isQdrantConnected = await verifyQdrant(3);
    } catch {
        isQdrantConnected = false;
    }

    // Stage 4: Local LLM Check / Auto-launch
    let isLlamaReady = false;
    const llmProvider = (process.env.LLM_PROVIDER || "llama.cpp").toLowerCase();
    if (llmProvider === "llama.cpp" || llmProvider === "llama" || llmProvider === "local") {
        try {
            const llamaProcessManager = require("../server/services/llamaProcessManager");
            const result = await llamaProcessManager.startServer({ silent: true });
            isLlamaReady = !!result.success;
        } catch {
            isLlamaReady = false;
        }
    } else {
        isLlamaReady = true; // Cloud providers (Groq/Gemini) treated as ready
    }

    // Stage 5: Print Development Control Center
    console.log();
    printControlCenter({
        version: "v1.0 Production",
        env: process.env.NODE_ENV === "production" ? "Production" : "Development",
        mongoConnected: isMongoConnected,
        qdrantConnected: isQdrantConnected,
        llamaReady: isLlamaReady,
        storageType: "Local Storage",
        cacheEnabled: true,
        workerStatus: "Idle"
    });

    // Stage 5.5: Port Reconciliation (Free ports 5000, 5001, 5173 if held by stale processes)
    const freePortIfOccupied = (port) => {
        try {
            if (process.platform === "win32") {
                const { execSync } = require("child_process");
                const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { shell: true, stdio: ["pipe", "pipe", "ignore"] }).toString();
                const lines = output.trim().split("\n");
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(Number(pid)) && Number(pid) !== process.pid) {
                        try {
                            execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
                            console.log(logger.yellow(`  [Port Cleaner] Freed port ${port} by terminating stale process (PID ${pid})`));
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {}
    };

    freePortIfOccupied(5000);
    freePortIfOccupied(5001);
    freePortIfOccupied(5173);

    // Stage 6: Spawn Microservices
    console.log(logger.cyan("Spawning EduMate microservice child processes...\n"));

    let backendProcess = null;
    let chunkingProcess = null;
    let frontendProcess = null;
    let isShuttingDown = false;

    const startBackend = () => {
        if (isShuttingDown) return;
        backendProcess = spawn("node", ["server/server.js"], {
            cwd: rootPath,
            stdio: "pipe",
            shell: true
        });
        setupLogger(backendProcess, "Backend", logger.green);
        backendProcess.on("close", (code) => {
            if (!isShuttingDown && code !== 0 && code !== null) {
                console.log(logger.yellow(`Backend process exited (code ${code}). Auto-restarting in 2s...`));
                setTimeout(startBackend, 2000);
            }
        });
    };

    const startFrontend = () => {
        if (isShuttingDown) return;
        frontendProcess = spawn("npm", ["run", "dev", "--prefix", "client"], {
            cwd: rootPath,
            stdio: "pipe",
            shell: true
        });
        setupLogger(frontendProcess, "Frontend", logger.blue);
        frontendProcess.on("close", (code) => {
            if (!isShuttingDown && code !== 0 && code !== null) {
                console.log(logger.yellow(`Frontend process exited (code ${code}). Auto-restarting in 2s...`));
                setTimeout(startFrontend, 2000);
            }
        });
    };

    // Stream log multiplexer
    const setupLogger = (proc, prefix, colorFn) => {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        proc.stdout?.on("data", (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) console.log(`${colorFn(`[${prefix}]`)} ${trimmed}`);
            }
        });

        proc.stderr?.on("data", (chunk) => {
            stderrBuffer += chunk.toString();
            const lines = stderrBuffer.split("\n");
            stderrBuffer = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) console.error(`${logger.red(`[${prefix} Error]`)} ${trimmed}`);
            }
        });
    };

    startBackend();
    startFrontend();

    // Stage 7: Health Monitoring & Browser Auto-Launch
    let browserOpened = false;
    const pollReadiness = setInterval(async () => {
        if (browserOpened || isShuttingDown) return;
        const [backendUp, frontendUp] = await Promise.all([
            checkHttpService("http://localhost:5000/api/health", 800),
            checkHttpService("http://localhost:5173", 800)
        ]);

        if (backendUp && frontendUp && !browserOpened) {
            browserOpened = true;
            clearInterval(pollReadiness);
            console.log("\n" + logger.green("======================================================="));
            console.log(logger.green("  🎉 EDUMATE PLATFORM READY & ACTIVE"));
            console.log(logger.cyan("  ➜ Web App (Frontend):  http://localhost:5173"));
            console.log(logger.cyan("  ➜ REST API (Backend):  http://localhost:5000"));
            console.log(logger.cyan("  ➜ Knowledge Studio:    http://localhost:5000/studio"));
            console.log(logger.green("=======================================================\n"));

            // Open browser automatically on Windows / macOS / Linux
            try {
                const openCmd = process.platform === "win32" ? "start" : (process.platform === "darwin" ? "open" : "xdg-open");
                require("child_process").exec(`${openCmd} http://localhost:5173`);
            } catch (_) {}
        }
    }, 1500);

    // Clear poll after 30s max
    setTimeout(() => clearInterval(pollReadiness), 30000);

    // Optional Debug Memory Monitor (Only in debug mode)
    if (isDebug) {
        setInterval(() => {
            const memory = process.memoryUsage();
            console.log(logger.gray(`[DEBUG Memory] RSS: ${(memory.rss / (1024 * 1024)).toFixed(1)}MB | Heap: ${(memory.heapUsed / (1024 * 1024)).toFixed(1)}MB`));
        }, 15000);
    }

    // Graceful Shutdown Cleanup
    const cleanExit = () => {
        isShuttingDown = true;
        try { backendProcess?.kill(); } catch (_) {}
        try { chunkingProcess?.kill(); } catch (_) {}
        try { frontendProcess?.kill(); } catch (_) {}
        process.exit();
    };

    process.on("SIGINT", cleanExit);
    process.on("SIGTERM", cleanExit);
    process.on("exit", cleanExit);
};

startDev().catch((err) => {
    logger.error(`Critical Dev Startup Failure: ${err.message}`);
    process.exit(1);
});
