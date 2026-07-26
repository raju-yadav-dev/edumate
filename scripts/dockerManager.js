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

/**
 * Checks if Qdrant is already responding, otherwise boots it via Docker Compose
 * @returns {Promise<boolean>} - True if running or successfully command-sent, false otherwise
 */
const startQdrantContainer = async () => {
    console.log(logger.cyan("Checking Qdrant vector database service state..."));
    
    // Check if port 6333 is already responding (indicating Qdrant is active)
    try {
        const response = await fetch("http://localhost:6333/api/v1/collections", { method: "GET" });
        if (response.ok || response.status === 404 || response.status === 200) {
            console.log(logger.green("✓ Qdrant service is already active on port 6333."));
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
