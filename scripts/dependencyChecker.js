const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Validates Node.js runtime version is >= 18 (required for native global fetch)
 */
const verifyNodeVersion = () => {
    const version = process.versions.node;
    const major = parseInt(version.split(".")[0], 10);

    if (major < 18) {
        console.error(logger.red(`❌ Error: Node.js version ${version} is too old. EduMate requires Node.js version >= 18.0.0 for built-in fetch support.`));
        process.exit(1);
    }
    console.log(logger.green(`✓ Node.js version validated: v${version}`));
    return true;
};

/**
 * Validates npm version is available
 */
const verifyNpmVersion = () => {
    try {
        const npmVersion = execSync("npm --version", { shell: true }).toString().trim();
        console.log(logger.green(`✓ npm version validated: v${npmVersion}`));
        return true;
    } catch {
        console.error(logger.red(`❌ Error: npm is not installed or not in system PATH.`));
        process.exit(1);
    }
};

/**
 * Checks and auto-installs missing npm dependencies defined in root and workspace package.json files
 */
const verifyDependencies = () => {
    console.log(logger.cyan("Checking workspace dependencies..."));
    
    const rootPath = path.resolve(__dirname, "..");
    const rootNodeModules = path.join(rootPath, "node_modules");

    // 1. If root node_modules is missing completely, run full workspace npm install
    if (!fs.existsSync(rootNodeModules)) {
        console.log(logger.yellow("⚠️ Root node_modules not found. Auto-installing workspace dependencies..."));
        try {
            execSync("npm install", { stdio: "inherit", cwd: rootPath, shell: true });
            console.log(logger.green("✓ Workspace dependencies installed successfully."));
        } catch (err) {
            console.error(logger.red(`❌ Failed to run npm install: ${err.message}`));
        }
    }

    // 2. Verify individual packages across workspace manifests (root, server, client)
    const paths = [
        path.join(rootPath, "package.json"),
        path.join(rootPath, "server", "package.json"),
        path.join(rootPath, "client", "package.json")
    ];

    const missing = [];

    for (const pkgPath of paths) {
        if (!fs.existsSync(pkgPath)) continue;
        try {
            const pkg = require(pkgPath);
            const pkgDir = path.dirname(pkgPath);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const dep of Object.keys(deps)) {
                if (dep === "client" || dep === "server") continue;
                
                try {
                    require.resolve(`${dep}/package.json`, { paths: [pkgDir, rootPath] });
                } catch {
                    try {
                        require.resolve(dep, { paths: [pkgDir, rootPath] });
                    } catch {
                        if (!missing.includes(dep)) {
                            missing.push(dep);
                        }
                    }
                }
            }
        } catch (_) {}
    }

    if (missing.length > 0) {
        console.log(logger.yellow(`⚠️ Missing required packages: ${missing.join(", ")}`));
        console.log(logger.cyan("Auto-installing missing npm packages..."));
        try {
            execSync("npm install", { stdio: "inherit", cwd: rootPath, shell: true });
            console.log(logger.green("✓ Missing packages successfully installed."));
        } catch (err) {
            console.error(logger.red(`❌ Failed to auto-install missing packages: ${err.message}`));
        }
    } else {
        console.log(logger.green("✓ All required npm dependencies verified."));
    }
};

module.exports = {
    verifyNodeVersion,
    verifyNpmVersion,
    verifyDependencies
};
