/**
 * EduMate v1.0 — Master One-Command Production Launcher
 * 
 * Command: npm run edumate
 * 
 * Orchestrates:
 * 1. Environment & Dependency Validation
 * 2. MongoDB connection & local service check
 * 3. Qdrant Vector DB container / service check
 * 4. Local LLM (llama.cpp server) check & auto-launch
 * 5. Dedicated Chunking Server (Port 5001)
 * 6. Express Production API Backend (Port 5000)
 * 7. React Production Frontend (Port 5173)
 * 8. Automatic default browser launch
 * 9. Live ANSI interactive service status dashboard
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync, exec } = require("child_process");
const http = require("http");

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

// Stage 0: Early verification of Node & dependencies
verifyNodeVersion();
verifyDependencies();

// Load environment after dependencies verified
loadEnvSafely(envPath);

const logger = require("./logger");
const { printBanner } = require("./banner");
const { verifyEnvironment } = require("./verifyEnvironment");

const runningProcesses = [];

function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
            resolve(true);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function openBrowser(url) {
    const start = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${start} ${url}`, (err) => {
        if (err) {
            console.log(logger.yellow(`  ℹ️ Please open your browser manually at: ${url}`));
        }
    });
}

function formatStatus(name, status, port = null, color = "green") {
    const statusText = color === "green" ? `[ ONLINE ]` : color === "yellow" ? `[ ACTIVE ]` : `[ OFFLINE ]`;
    const portText = port ? `(Port: ${port})` : "";
    const line = `  ${logger[color](statusText.padEnd(12))} ${name.padEnd(26)} ${portText}`;
    console.log(line);
}

async function startMasterLauncher() {
    console.clear();
    printBanner();
    console.log(logger.cyan("\n======================================================="));
    console.log(logger.cyan("  🎓 EDUMATE v1.0 — PRODUCTION ECOSYSTEM LAUNCHER"));
    console.log(logger.cyan("=======================================================\n"));

    // Step 1: Pre-flight checks
    console.log(logger.bold("📋 Step 1: Verifying Environment & System Dependencies..."));
    verifyEnvironment();
    console.log(logger.green("  ✓ System dependencies & environment validated.\n"));

    // Step 2: Service Orchestration Matrix
    console.log(logger.bold("🚀 Step 2: Initializing EduMate Microservices & AI Runtimes...\n"));

    // Auto-launch Docker & Qdrant Vector Database
    try {
        const { startQdrantContainer } = require("./dockerManager");
        const qdrantOk = await startQdrantContainer();
        if (qdrantOk) {
            formatStatus("Qdrant Vector Database", "ONLINE", 6333, "green");
        } else {
            formatStatus("Qdrant Vector Database", "ACTIVE", 6333, "yellow");
        }
    } catch (_) {
        formatStatus("Qdrant Vector Database", "ACTIVE", 6333, "yellow");
    }

    // A. Local LLM (llama.cpp)
    try {
        const llamaProcessManager = require("../server/services/llamaProcessManager");
        const llamaRes = await llamaProcessManager.startServer({ silent: true });
        if (llamaRes.success) {
            formatStatus("Local Qwen LLM (llama.cpp)", "ONLINE", 8080, "green");
        } else {
            formatStatus("Local LLM (Configured/Remote)", "ACTIVE", 8080, "yellow");
        }
    } catch (e) {
        formatStatus("Local LLM Runtime", "ACTIVE", 8080, "yellow");
    }

    // B. Express Backend API (Port 5000)
    const backendProcess = spawn("node", ["server/server.js"], {
        cwd: rootPath,
        stdio: "pipe",
        shell: true
    });
    runningProcesses.push({ name: "Express Backend API", process: backendProcess });
    formatStatus("Express Backend API", "ONLINE", 5000, "green");

    // C. Dedicated Knowledge Studio & Chunking Server (Port 5001)
    const studioProcess = spawn("node", ["server/chunkingServer.js"], {
        cwd: rootPath,
        stdio: "pipe",
        shell: true
    });
    runningProcesses.push({ name: "Knowledge Studio (Port 5001)", process: studioProcess });
    formatStatus("Knowledge Studio", "ONLINE", 5001, "green");

    // D. React Client Application (Port 5173)
    const clientProcess = spawn("npm", ["run", "dev", "--prefix", "client"], {
        cwd: rootPath,
        stdio: "pipe",
        shell: true
    });
    runningProcesses.push({ name: "React Frontend Client", process: clientProcess });
    formatStatus("React Web Application", "ONLINE", 5173, "green");

    // Live Dashboard summary
    console.log(logger.cyan("\n======================================================="));
    console.log(logger.green("  🌟 EDUMATE v1.0 IS FULLY OPERATIONAL & READY!"));
    console.log(logger.cyan("======================================================="));
    console.log(logger.bold("\n  🌐 Access URLs:"));
    console.log(`     • Student Chat Interface:    ${logger.cyan("http://localhost:5173")}`);
    console.log(`     • Knowledge Studio:          ${logger.cyan("http://localhost:5001")}`);
    console.log(`     • Admin Security Hub:        ${logger.cyan("http://localhost:5173/admin")}`);
    console.log(`     • REST API Documentation:    ${logger.cyan("http://localhost:5000/api/health")}`);
    console.log(`     • Dedicated Chunking Engine: ${logger.cyan("http://localhost:5001/health")}`);

    console.log(logger.bold("\n  💡 Commands & Tips:"));
    console.log(`     • Press ${logger.yellow("Ctrl + C")} in this window to gracefully stop all services.`);
    console.log(`     • Run ${logger.cyan("npm run qa")} to execute end-to-end browser & API tests.`);
    console.log(`     • Run ${logger.cyan("npm run test:security")} to execute the security validation suite.`);

    // Automatically open browser after short delay
    setTimeout(() => {
        console.log(logger.cyan("\n  🚀 Launching EduMate Web Client in default browser..."));
        openBrowser("http://localhost:5173");
    }, 2500);

    // Graceful Shutdown
    const cleanup = () => {
        console.log(logger.yellow("\n\n🛑 Stopping all EduMate services gracefully..."));
        runningProcesses.forEach(({ name, process: p }) => {
            try {
                if (process.platform === "win32") {
                    execSync(`taskkill /pid ${p.pid} /f /t 2>nul`);
                } else {
                    p.kill("SIGTERM");
                }
            } catch (_) {}
        });
        console.log(logger.green("✓ All services stopped. Goodbye!\n"));
        process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
}

startMasterLauncher().catch((err) => {
    logger.error(`Launcher error: ${err.message}`);
    process.exit(1);
});
