const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const rootPath = path.resolve(__dirname, "..");
const envPath = path.join(rootPath, ".env");

// Load env variables
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
}

const logger = require("./logger");
const { verifyNodeVersion, verifyDependencies } = require("./dependencyChecker");
const { verifyEnvironment } = require("./verifyEnvironment");
const { startQdrantContainer } = require("./dockerManager");
const { verifyMongo } = require("./verifyMongo");
const { verifySupabase } = require("./verifySupabase");
const { verifyGroq } = require("./verifyGroq");
const { verifyQdrant } = require("./verifyQdrant");
const { printBanner, printDashboard } = require("./banner");

const pingOllama = async (baseUrl) => {
    try {
        const response = await fetch(`${baseUrl}/api/tags`);
        return response.ok;
    } catch (e) {
        return false;
    }
};

const startDev = async () => {
    printBanner();
    console.log(logger.cyan("🚀 Starting EduMate automated development launcher...\n"));

    let ollamaProcess = null;

    // 1. Check Node and npm version
    verifyNodeVersion();

    // 2. Check env variables
    const envOk = verifyEnvironment();
    if (!envOk) {
        logger.error("❌ Startup blocked: Environment variables are not configured correctly.");
        process.exit(1);
    }
    console.log();

    // 3. Check dependencies
    verifyDependencies();
    console.log();

    // 4. Start Qdrant if needed
    const qdrantTriggered = await startQdrantContainer();
    console.log();

    // Poll Qdrant (retrying up to 15 attempts while Docker initializes)
    const qdrantOk = await verifyQdrant(15);
    if (!qdrantOk) {
        logger.error("❌ Startup blocked: Unable to verify Qdrant database state.");
        process.exit(1);
    }
    console.log();

    // 5. Check MongoDB
    const mongoOk = await verifyMongo();
    if (!mongoOk) {
        logger.error("❌ Startup blocked: MongoDB connection check failed.");
        process.exit(1);
    }
    console.log();

    // 6. Check Supabase
    const supabaseOk = await verifySupabase();
    if (!supabaseOk) {
        logger.error("❌ Startup blocked: Supabase connection check failed.");
        process.exit(1);
    }
    console.log();

    // 7. Start/Check Ollama if provider is ollama
    if (process.env.LLM_PROVIDER === "ollama") {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const isRunning = await pingOllama(baseUrl);
        if (!isRunning) {
            console.log(logger.cyan("Ollama not active. Starting local Ollama service ('ollama serve')..."));
            ollamaProcess = spawn("ollama", ["serve"], {
                stdio: "pipe",
                shell: true
            });
            
            let stdoutBuffer = "";
            let stderrBuffer = "";
            ollamaProcess.stdout.on("data", (chunk) => {
                stdoutBuffer += chunk.toString();
                const lines = stdoutBuffer.split("\n");
                stdoutBuffer = lines.pop();
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) console.log(`${logger.yellow("[Ollama]")} ${trimmed}`);
                }
            });
            ollamaProcess.stderr.on("data", (chunk) => {
                stderrBuffer += chunk.toString();
                const lines = stderrBuffer.split("\n");
                stderrBuffer = lines.pop();
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) console.error(`${logger.red("[Ollama Error]")} ${trimmed}`);
                }
            });

            ollamaProcess.on("close", (code) => {
                console.log(logger.yellow(`Ollama process exited with code ${code}`));
            });

            // wait 2.5 seconds for service startup
            await new Promise((resolve) => setTimeout(resolve, 2500));
        } else {
            console.log(logger.green("✓ Ollama service is already running."));
        }
    }

    // Check Groq API
    const aiOk = await verifyGroq();
    if (!aiOk) {
        logger.warn("⚠️ WARNING: Groq API connection check failed. Chat bot completions will fail until valid keys are configured in .env or the admin settings panel.");
    }
    console.log();

    // 8. Print Dashboard
    printDashboard({
        env: process.env.NODE_ENV || "development",
        backendUrl: `http://localhost:${process.env.PORT || "5000"}`,
        frontendUrl: "http://localhost:5173"
    });

    // 9. Start Express Backend & React Frontend Concurrently
    console.log(logger.cyan("\nSpawning Frontend and Backend child processes...\n"));

    // Determine runner (nodemon for backend if installed, otherwise node)
    let backendCmd = "node";
    let backendArgs = ["server.js"];
    try {
        require.resolve("nodemon");
        backendCmd = "npx";
        backendArgs = ["nodemon", "server.js"];
    } catch (e) {
        // nodemon not found, fallback to node
    }

    const backendProcess = spawn(backendCmd, backendArgs, {
        cwd: path.join(rootPath, "server"),
        stdio: "pipe",
        shell: true
    });

    const frontendProcess = spawn("npx", ["vite"], {
        cwd: path.join(rootPath, "client"),
        stdio: "pipe",
        shell: true
    });

    // Logging helpers with stream buffering to prevent partial line logs
    const setupLogger = (process, prefix, colorFn) => {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        process.stdout.on("data", (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop(); // save remaining part
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) console.log(`${colorFn(`[${prefix}]`)} ${trimmed}`);
            }
        });

        process.stderr.on("data", (chunk) => {
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
    setupLogger(frontendProcess, "Frontend", logger.blue);

    // Stop processes if one exits or parent process exits
    const cleanExit = () => {
        try {
            backendProcess.kill();
        } catch (e) {}
        try {
            frontendProcess.kill();
        } catch (e) {}
        if (ollamaProcess) {
            try {
                ollamaProcess.kill();
            } catch (e) {}
        }
        process.exit();
    };

    process.on("SIGINT", cleanExit);
    process.on("SIGTERM", cleanExit);
    process.on("exit", cleanExit);

    backendProcess.on("close", (code) => {
        console.log(logger.yellow(`Backend process exited with code ${code}`));
        cleanExit();
    });

    frontendProcess.on("close", (code) => {
        console.log(logger.yellow(`Frontend process exited with code ${code}`));
        cleanExit();
    });
};

startDev().catch((err) => {
    logger.error(`Critical Dev Startup Failure: ${err.message}`);
    process.exit(1);
});
