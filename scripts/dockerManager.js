const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const logger = require("./logger");

/**
 * Checks if docker CLI command is installed
 * @returns {boolean}
 */
const isDockerInstalled = () => {
    try {
        execSync("docker --version", { stdio: "ignore", shell: true });
        return true;
    } catch {
        return false;
    }
};

/**
 * Validates availability of Docker Compose (V2 command or V1 plugin)
 * @returns {string|null} - The command prefix to execute compose tasks
 */
const isDockerComposeInstalled = () => {
    try {
        execSync("docker compose version", { stdio: "ignore", shell: true });
        return "docker compose";
    } catch {
        try {
            execSync("docker-compose --version", { stdio: "ignore", shell: true });
            return "docker-compose";
        } catch {
            return null;
        }
    }
};

/**
 * Checks if the Docker daemon/engine is active and responsive
 * @returns {boolean}
 */
const isDockerDaemonRunning = () => {
    try {
        execSync("docker ps", { stdio: "ignore", shell: true, timeout: 15000 });
        return true;
    } catch {
        try {
            execSync("docker info", { stdio: "ignore", shell: true, timeout: 15000 });
            return true;
        } catch {
            return false;
        }
    }
};

/**
 * Finds the Docker Desktop executable path across common Windows locations
 * @returns {string|null}
 */
const findDockerDesktopExecutable = () => {
    if (process.platform !== "win32") return null;

    const candidates = [
        "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
        "C:\\Program Files\\Docker\\Docker Desktop.exe",
        path.join(process.env.LOCALAPPDATA || "", "Docker", "Docker Desktop.exe"),
        path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe")
    ];

    for (const exePath of candidates) {
        if (exePath && fs.existsSync(exePath)) {
            return exePath;
        }
    }
    return null;
};

/**
 * Automatically launches the Docker Desktop daemon if installed
 * @returns {Promise<boolean>}
 */
const startDockerDaemon = async () => {
    if (isDockerDaemonRunning()) {
        return true;
    }

    if (process.platform === "win32") {
        const dockerExe = findDockerDesktopExecutable();
        if (!dockerExe) {
            console.log(logger.yellow("⚠️ Docker Desktop executable not found in default installation paths."));
            return false;
        }

        console.log(logger.cyan("🐳 Docker daemon is not running. Launching Docker Desktop automatically..."));
        try {
            const child = spawn(dockerExe, [], {
                detached: true,
                stdio: "ignore",
                shell: true
            });
            child.unref();

            // Wait and poll for Docker daemon to become responsive
            console.log(logger.cyan("⏳ Waiting for Docker daemon to initialize (this may take 15-30 seconds)..."));
            for (let i = 1; i <= 30; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                if (isDockerDaemonRunning()) {
                    console.log(logger.green("✓ Docker Desktop daemon has started successfully."));
                    return true;
                }
                if (i % 5 === 0) {
                    console.log(logger.yellow(`  Waiting for Docker daemon... (${i * 2}s elapsed)`));
                }
            }
        } catch (err) {
            console.error(logger.red(`❌ Failed to launch Docker Desktop: ${err.message}`));
        }
    } else if (process.platform === "darwin") {
        console.log(logger.cyan("🐳 Attempting to launch Docker Desktop on macOS..."));
        try {
            execSync("open -a Docker", { stdio: "ignore" });
            for (let i = 1; i <= 30; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                if (isDockerDaemonRunning()) {
                    console.log(logger.green("✓ Docker daemon is active."));
                    return true;
                }
            }
        } catch (_) {}
    }

    return isDockerDaemonRunning();
};

/**
 * Probes HTTP responsiveness of Qdrant
 * @param {string} url 
 * @param {number} timeoutMs 
 * @returns {Promise<boolean>}
 */
const isQdrantHttpActive = (url = "http://127.0.0.1:6333", timeoutMs = 1500) => {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(url);
            const req = http.get({
                hostname: parsed.hostname,
                port: parsed.port || 6333,
                path: "/collections",
                timeout: timeoutMs
            }, (res) => {
                resolve(res.statusCode < 500);
            });
            req.on("error", () => resolve(false));
            req.on("timeout", () => {
                req.destroy();
                resolve(false);
            });
        } catch {
            resolve(false);
        }
    });
};

/**
 * Checks if Qdrant is already responding, otherwise boots it automatically via Docker / Docker Compose
 * @returns {Promise<boolean>} - True if running or successfully started, false otherwise
 */
const startQdrantContainer = async () => {
    const qUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
    console.log(logger.cyan(`🔍 Checking Qdrant Vector Database service (${qUrl})...`));

    // 1. If already active, return immediately
    if (await isQdrantHttpActive(qUrl, 1000)) {
        console.log(logger.green("✓ Qdrant vector database is already active and responsive."));
        return true;
    }

    // 2. Check Docker CLI
    if (!isDockerInstalled()) {
        console.log(logger.yellow("⚠️ Warning: Qdrant is offline and Docker CLI is not installed on this system."));
        console.log(logger.yellow("  Please install Docker Desktop or run Qdrant manually on port 6333."));
        return false;
    }

    // 3. Ensure Docker Daemon is running
    if (!isDockerDaemonRunning()) {
        const daemonStarted = await startDockerDaemon();
        if (!daemonStarted) {
            console.log(logger.yellow("⚠️ Docker daemon could not be started automatically. Please start Docker Desktop manually."));
            return false;
        }
    }

    // 4. Check if an existing Qdrant container is stopped
    console.log(logger.cyan("🚀 Automatically starting Qdrant container..."));
    const containerNames = ["edumate-qdrant", "edumate_qdrant", "qdrant"];
    let startedExisting = false;

    for (const name of containerNames) {
        try {
            const psOutput = execSync(`docker ps -a --filter "name=${name}" --format "{{.Names}}"`, { shell: true }).toString().trim();
            if (psOutput.includes(name)) {
                console.log(logger.cyan(`  Found existing container '${name}'. Starting container...`));
                execSync(`docker start ${name}`, { stdio: "ignore", shell: true });
                startedExisting = true;
                break;
            }
        } catch (_) {}
    }

    // 5. If no existing container, use Docker Compose or Docker Run
    if (!startedExisting) {
        const rootPath = path.resolve(__dirname, "..");
        const dockerComposePath = path.join(rootPath, "docker", "docker-compose.yml");
        const rootComposePath = path.join(rootPath, "docker-compose.yml");
        const composeCmd = isDockerComposeInstalled();

        if (composeCmd && fs.existsSync(dockerComposePath)) {
            try {
                console.log(logger.cyan("  Running Docker Compose for Qdrant service..."));
                execSync(`${composeCmd} -f "${dockerComposePath}" up -d`, { stdio: "ignore", cwd: rootPath, shell: true });
            } catch (err) {
                console.log(logger.yellow(`  Compose fallback: ${err.message}`));
            }
        } else if (composeCmd && fs.existsSync(rootComposePath)) {
            try {
                console.log(logger.cyan("  Running Root Docker Compose for Qdrant service..."));
                execSync(`${composeCmd} -f "${rootComposePath}" up -d qdrant`, { stdio: "ignore", cwd: rootPath, shell: true });
            } catch (_) {}
        } else {
            // Direct docker run fallback
            try {
                console.log(logger.cyan("  Creating and starting 'edumate-qdrant' container via Docker CLI..."));
                execSync("docker run -d -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage --name edumate-qdrant qdrant/qdrant:latest", { stdio: "ignore", shell: true });
            } catch (runErr) {
                console.log(logger.yellow(`  Docker run: ${runErr.message}`));
            }
        }
    }

    // 6. Poll until Qdrant is ready
    console.log(logger.cyan("⏳ Waiting for Qdrant service to become ready on port 6333..."));
    for (let i = 1; i <= 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (await isQdrantHttpActive(qUrl, 1000)) {
            console.log(logger.green("✓ Qdrant Vector Database is online and ready."));
            return true;
        }
    }

    console.log(logger.yellow("⚠️ Qdrant container started, but service did not respond within 15 seconds."));
    return false;
};

/**
 * Stops Qdrant container
 * @returns {boolean}
 */
const stopQdrantContainer = () => {
    if (!isDockerInstalled()) return false;

    console.log(logger.cyan("Stopping Qdrant container..."));
    try {
        execSync("docker stop edumate-qdrant edumate_qdrant", { stdio: "ignore", shell: true });
        console.log(logger.green("✓ Qdrant container stopped successfully."));
        return true;
    } catch {
        return false;
    }
};

module.exports = {
    isDockerInstalled,
    isDockerDaemonRunning,
    startDockerDaemon,
    isDockerComposeInstalled,
    isQdrantHttpActive,
    startQdrantContainer,
    stopQdrantContainer
};
