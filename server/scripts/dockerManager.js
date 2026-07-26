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

/**
 * Checks if Qdrant is already responding, otherwise boots it via Docker Compose
 * @returns {Promise<boolean>} - True if running or successfully command-sent, false otherwise
 */
const startQdrantContainer = async () => {
    console.log(colors.cyan("Checking Qdrant vector database service state..."));
    
    // Check if port 6333 is already responding (indicating Qdrant is active)
    try {
        const response = await fetch("http://127.0.0.1:6333/api/v1/collections", { method: "GET" });
        if (response.ok || response.status === 404 || response.status === 200) {
            console.log(colors.green("✓ Qdrant service is already active on port 6333."));
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
