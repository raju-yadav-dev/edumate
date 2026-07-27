const { execSync } = require("child_process");
const logger = require("./logger");

/**
 * Checks if docker CLI command is installed
 * @returns {boolean}
 */
const isDockerInstalled = () => {
    try {
        execSync("docker --version", { stdio: "pipe", shell: true });
        return true;
    } catch (e) {
        const stderr = e.stderr ? e.stderr.toString().trim() : "";
        const stdout = e.stdout ? e.stdout.toString().trim() : "";
        console.log(logger.yellow(`  [Debug] Docker CLI check failed: ${e.message}\n  Stdout: ${stdout}\n  Stderr: ${stderr}`));
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
    } catch (e) {
        try {
            execSync("docker-compose --version", { stdio: "ignore", shell: true });
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

    console.log(logger.cyan("Docker daemon is not running. Attempting to launch Docker Desktop automatically..."));
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
                console.log(logger.green("✓ Docker Desktop daemon has started successfully."));
                return true;
            }
            if (i % 5 === 0) {
                console.log(logger.yellow(`  Waiting for Docker daemon to initialize... (Attempt ${i}/30)`));
            }
        }
    } catch (err) {
        console.error(logger.red(`❌ Failed to automatically launch Docker Desktop: ${err.message}`));
    }
    return false;
};

/**
 * Checks if Qdrant is already responding, otherwise boots it via Docker Compose
 * @returns {Promise<boolean>} - True if running or successfully command-sent, false otherwise
 */
const startQdrantContainer = async () => {
    console.log(logger.cyan("Checking Qdrant vector database service state..."));
    
    // Check if port 6333 is already responding (indicating Qdrant is active)
    try {
        const qUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
        const response = await fetch(`${qUrl}/api/v1/collections`, { method: "GET" });
        if (response.ok || response.status === 404 || response.status === 200) {
            console.log(logger.green("✓ Qdrant service is already active."));
            return true;
        }
    } catch (e) {
        // Service is down, needs starting
    }

    if (!isDockerInstalled()) {
        console.log(logger.yellow("⚠️ Warning: Qdrant is not active and Docker CLI is not installed on this system."));
        console.log(logger.yellow("Automated local service bootstrapping skipped. Ensure Qdrant runs manually."));
        return false;
    }

    // Ensure Docker Daemon is active
    if (!isDockerDaemonRunning()) {
        const daemonStarted = await startDockerDaemon();
        if (!daemonStarted) {
            console.log(logger.yellow("⚠️ Docker daemon is not active. Automated bootstrapping skipped. Please start Docker manually."));
            return false;
        }
    }

    const composeCmd = isDockerComposeInstalled();
    if (!composeCmd) {
        console.log(logger.yellow("⚠️ Warning: Qdrant is not active and Docker Compose is not installed on this system."));
        console.log(logger.yellow("Automated local service bootstrapping skipped. Ensure Qdrant runs manually."));
        return false;
    }

    console.log(logger.cyan("Qdrant not active. Attempting automated local service bootstrap via Docker Compose..."));
    try {
        execSync(`${composeCmd} -f docker/docker-compose.yml up -d`, { stdio: "inherit", cwd: process.cwd(), shell: true });
        console.log(logger.green("✓ Docker Compose command executed. Waiting for service launch..."));
        return true;
    } catch (err) {
        console.error(logger.red(`❌ Failed to start Qdrant container: ${err.message}`));
        return false;
    }
};

/**
 * Stops Qdrant container using Docker Compose
 * @returns {boolean} - True if successfully stopped, false otherwise
 */
const stopQdrantContainer = () => {
    if (!isDockerInstalled()) {
        return false;
    }

    const composeCmd = isDockerComposeInstalled();
    if (!composeCmd) {
        return false;
    }

    console.log(logger.cyan("Attempting to stop Qdrant container via Docker Compose..."));
    try {
        execSync(`${composeCmd} -f docker/docker-compose.yml down`, { stdio: "inherit", cwd: process.cwd(), shell: true });
        console.log(logger.green("✓ Docker Compose down command executed successfully."));
        return true;
    } catch (err) {
        console.error(logger.red(`❌ Failed to stop Qdrant container: ${err.message}`));
        return false;
    }
};

module.exports = {
    isDockerInstalled,
    isDockerComposeInstalled,
    startQdrantContainer,
    stopQdrantContainer
};
