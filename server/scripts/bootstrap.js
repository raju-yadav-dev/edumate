const colors = require("./colors");
const { verifyNodeVersion, verifyDependencies } = require("./dependencyInstaller");
const { verifyEnvironment } = require("./verifyEnvironment");
const { isDockerInstalled, isDockerComposeInstalled } = require("./dockerManager");
const { execSync } = require("child_process");
const { printBanner } = require("./banner");

/**
 * Boots setup scripts (installs packages, downloads containers, verifies .env files)
 */
const runBootstrap = async () => {
    printBanner();
    console.log(colors.cyan("🏗️ Running EduMate Setup Bootstrap...\n"));

    // 1. Verify Node version
    verifyNodeVersion();
    
    // 2. Verify and recover npm dependencies
    verifyDependencies();

    console.log();

    // 3. Verify env key variables
    const envOk = verifyEnvironment();
    if (!envOk) {
        console.error(colors.red("❌ Setup failed: Invalid env configuration. Check warnings above."));
        process.exit(1);
    }

    console.log();

    // 4. Pull local Docker images if available
    if (isDockerInstalled()) {
        const composeCmd = isDockerComposeInstalled();
        if (composeCmd) {
            console.log(colors.cyan("Pulling latest Qdrant docker image via compose..."));
            try {
                execSync(`${composeCmd} pull`, { stdio: "inherit", cwd: process.cwd() });
                console.log(colors.green("✓ Qdrant docker image successfully pulled."));
            } catch (err) {
                console.log(colors.yellow(`⚠️ Warning: Failed to pull docker image via compose: ${err.message}`));
            }
        } else {
            console.log(colors.cyan("Docker is installed. Pulling Qdrant image via docker CLI directly..."));
            try {
                execSync("docker pull qdrant/qdrant:latest", { stdio: "inherit", cwd: process.cwd() });
                console.log(colors.green("✓ Qdrant docker image successfully pulled."));
            } catch (err) {
                console.log(colors.yellow(`⚠️ Warning: Failed to pull Qdrant image directly: ${err.message}`));
            }
        }
    } else {
        console.log(colors.yellow("⚠️ Warning: Docker is not installed on this system. Local auto-bootstrap skipped."));
        console.log(colors.yellow("Please ensure Qdrant service runs manually at the configured QDRANT_URL."));
    }

    console.log("\n" + colors.green("✓ EduMate setup bootstrap completed successfully. Run 'npm run dev' to start the application!"));
};

runBootstrap().catch((err) => {
    console.error("Bootstrap execution failed:", err);
    process.exit(1);
});
