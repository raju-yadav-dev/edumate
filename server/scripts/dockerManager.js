const { execSync } = require("child_process");
const colors = require("./colors");

/**
 * Checks if docker CLI command is installed
 * @returns {boolean}
 */
const isDockerInstalled = () => {
    try {
        execSync("docker --version", { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Validates availability of Docker Compose (V2 command or V1 plugin)
 * @returns {string|null} - The command prefix to execute compose tasks
 */
const isDockerComposeInstalled = () => {
    try {
        execSync("docker compose version", { stdio: "ignore" });
        return "docker compose";
    } catch (e) {
        try {
            execSync("docker-compose --version", { stdio: "ignore" });
            return "docker-compose";
        } catch (err) {
            return null;
        }
    }
};

const isDockerDaemonRunning = () => {
    try {
        execSync("docker info", { stdio: "ignore", shell: true });
        return true;
    } catch (e) {
        return false;
    }
};

const startDockerDaemon = async () => {
    if (process.platform !== "win32") {
        return false;
    }

    const defaultPath = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    const fs = require("fs");
    if (!fs.existsSync(defaultPath)) {
        return false;
    }

    console.log(colors.cyan("Docker daemon is not running. Attempting to launch Docker Desktop automatically..."));
    try {
        const { spawn } = require("child_process");
        const child = spawn(defaultPath, [], {
            detached: true,
            stdio: "ignore"
        });
        child.unref();

        // Wait and poll for the daemon to start (up to 30 attempts, 2 seconds each)
        for (let i = 1; i <= 30; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            if (isDockerDaemonRunning()) {
                console.log(colors.green("✓ Docker Desktop daemon has started successfully."));
                return true;
            }
            if (i % 5 === 0) {
                console.log(colors.yellow(`  Waiting for Docker daemon to initialize... (Attempt ${i}/30)`));
            }
        }
    } catch (err) {
        console.error(colors.red(`❌ Failed to automatically launch Docker Desktop: ${err.message}`));
    }
    return false;
};

/**
 * Checks if Qdrant is already responding, otherwise boots it via Docker Compose
 * @returns {Promise<boolean>} - True if running or successfully command-sent, false otherwise
 */
const startQdrantContainer = async () => {
    console.log(colors.cyan("Checking Qdrant vector database service state..."));
    
    // Check if port 6333 is already responding (indicating Qdrant is active)
    try {
        const qUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
        const response = await fetch(`${qUrl}/api/v1/collections`, { method: "GET" });
        if (response.ok || response.status === 404 || response.status === 200) {
            console.log(colors.green("✓ Qdrant service is already active."));
            return true;
        }
    } catch (e) {
        // Service is down, needs starting
    }

    if (!isDockerInstalled()) {
        console.log(colors.yellow("⚠️ Warning: Qdrant is not active and Docker CLI is not installed on this system."));
        console.log(colors.yellow("Automated local service bootstrapping skipped. Ensure Qdrant runs manually."));
        return false;
    }

    // Ensure Docker Daemon is active
    if (!isDockerDaemonRunning()) {
        const daemonStarted = await startDockerDaemon();
        if (!daemonStarted) {
            console.log(colors.yellow("⚠️ Docker daemon is not active. Automated bootstrapping skipped. Please start Docker manually."));
            return false;
        }
    }

    const composeCmd = isDockerComposeInstalled();
    if (!composeCmd) {
        console.log(colors.yellow("⚠️ Warning: Qdrant is not active and Docker Compose is not installed on this system."));
        console.log(colors.yellow("Automated local service bootstrapping skipped. Ensure Qdrant runs manually."));
        return false;
    }

    console.log(colors.cyan("Qdrant not active. Attempting automated local service bootstrap via Docker Compose..."));
    try {
        execSync(`${composeCmd} up -d`, { stdio: "inherit", cwd: process.cwd() });
        console.log(colors.green("✓ Docker Compose command executed. Waiting for service launch..."));
        return true;
    } catch (err) {
        console.error(colors.red(`❌ Failed to start Qdrant container: ${err.message}`));
        return false;
    }
};

module.exports = {
    isDockerInstalled,
    isDockerComposeInstalled,
    startQdrantContainer
};
