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

if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
}

const logger = require("./logger");
const { verifyNodeVersion, verifyDependencies } = require("./dependencyChecker");
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
    verifyNodeVersion();
    const envOk = verifyEnvironment();
    if (!envOk) {
        logger.error("❌ Startup blocked: Environment variables are not configured correctly.");
        process.exit(1);
    }
    verifyDependencies();

    // Stage 2: Storage Root Verification
    let localStorageManager;
    try {
        localStorageManager = require("../server/storage/localStorageManager");
        localStorageManager.ensureStorageRoot();
    } catch (_) {}

    // Stage 3: Probe Infrastructure Services
    let isMongoConnected = true;
    try {
        const { verifyMongo } = require("./verifyMongo");
        isMongoConnected = await verifyMongo();
    } catch {
        isMongoConnected = false;
    }

    let isQdrantConnected = true;
    try {
        const { verifyQdrant } = require("./verifyQdrant");
        isQdrantConnected = await verifyQdrant(1);
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

    // Stage 6: Spawn Microservices
    console.log(logger.cyan("Spawning EduMate microservice child processes...\n"));

    const backendProcess = spawn("node", ["server/server.js"], {
        cwd: rootPath,
        stdio: "pipe",
        shell: true
    });

    const chunkingProcess = spawn("node", ["server/chunkingServer.js"], {
        cwd: rootPath,
        stdio: "pipe",
        shell: true
    });

    const frontendProcess = spawn("npx", ["vite"], {
        cwd: path.join(rootPath, "client"),
        stdio: "pipe",
        shell: true
    });

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

    setupLogger(backendProcess, "Backend", logger.green);
    setupLogger(chunkingProcess, "Studio", logger.yellow);
    setupLogger(frontendProcess, "Frontend", logger.blue);

    // Optional Debug Memory Monitor (Only in debug mode)
    if (isDebug) {
        setInterval(() => {
            const memory = process.memoryUsage();
            console.log(logger.gray(`[DEBUG Memory] RSS: ${(memory.rss / (1024 * 1024)).toFixed(1)}MB | Heap: ${(memory.heapUsed / (1024 * 1024)).toFixed(1)}MB`));
        }, 15000);
    }

    // Graceful Shutdown Cleanup
    const cleanExit = () => {
        try { backendProcess.kill(); } catch (_) {}
        try { chunkingProcess.kill(); } catch (_) {}
        try { frontendProcess.kill(); } catch (_) {}
        process.exit();
    };

    process.on("SIGINT", cleanExit);
    process.on("SIGTERM", cleanExit);
    process.on("exit", cleanExit);

    backendProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
            console.log(logger.yellow(`Backend process exited with code ${code}`));
        }
    });

    chunkingProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
            console.log(logger.yellow(`Studio process exited with code ${code}`));
        }
    });

    frontendProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
            console.log(logger.yellow(`Frontend process exited with code ${code}`));
        }
    });
};

startDev().catch((err) => {
    logger.error(`Critical Dev Startup Failure: ${err.message}`);
    process.exit(1);
});
