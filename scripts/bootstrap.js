const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const logger = require("./logger");
const { verifyNodeVersion, verifyNpmVersion, verifyDependencies } = require("./dependencyChecker");
const { isDockerInstalled, isDockerComposeInstalled } = require("./dockerManager");

const runBootstrap = async () => {
    logger.info("🏗️ Starting EduMate Setup Bootstrap...\n");

    // 1. Verify Node.js version
    verifyNodeVersion();

    // 2. Verify npm version
    verifyNpmVersion();

    // 3. Verify .env file (copy .env.example to .env if not exists)
    const rootPath = path.resolve(__dirname, "..");
    const envPath = path.join(rootPath, ".env");
    const envExamplePath = path.join(rootPath, ".env.example");

    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            console.log(logger.cyan("Copying .env.example to .env..."));
            fs.copyFileSync(envExamplePath, envPath);
            console.log(logger.green("✓ Created .env file from .env.example."));
        } else {
            console.error(logger.red("❌ Error: .env.example is missing at root. Unable to bootstrap .env."));
            process.exit(1);
        }
    } else {
        console.log(logger.green("✓ .env file verified."));
    }

    // 4. Create missing folders
    const uploadsDir = path.join(rootPath, "server", "uploads");
    if (!fs.existsSync(uploadsDir)) {
        console.log(logger.cyan("Creating server uploads directory..."));
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(logger.green("✓ Server uploads directory created."));
    }

    // 5. Pull Docker images
    if (isDockerInstalled()) {
        const composeCmd = isDockerComposeInstalled();
        if (composeCmd) {
            console.log(logger.cyan("Pulling latest Qdrant docker image via compose..."));
            try {
                execSync(`${composeCmd} -f docker/docker-compose.yml pull`, { stdio: "inherit", cwd: rootPath, shell: true });
                console.log(logger.green("✓ Qdrant docker image successfully pulled."));
            } catch (err) {
                console.log(logger.yellow(`⚠️ Warning: Failed to pull docker image via compose: ${err.message}`));
            }
        } else {
            console.log(logger.cyan("Docker is installed. Pulling Qdrant image via docker CLI directly..."));
            try {
                execSync("docker pull qdrant/qdrant:latest", { stdio: "inherit", cwd: rootPath, shell: true });
                console.log(logger.green("✓ Qdrant docker image successfully pulled."));
            } catch (err) {
                console.log(logger.yellow(`⚠️ Warning: Failed to pull Qdrant image directly: ${err.message}`));
            }
        }
    } else {
        console.log(logger.yellow("⚠️ Warning: Docker is not installed on this system. Qdrant image pull skipped."));
    }

    // 6. Install root & workspace dependencies
    verifyDependencies();

    console.log("\n" + logger.green("✓ EduMate bootstrap completed successfully."));
};

if (require.main === module) {
    runBootstrap().catch(err => {
        logger.error(`Bootstrap execution failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { runBootstrap };
