const { execSync } = require("child_process");
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
    } catch (e) {
        console.error(logger.red(`❌ Error: npm is not installed or not in system PATH.`));
        process.exit(1);
    }
};

/**
 * Checks and installs missing npm dependencies defined in root and workspace package.json files
 */
const verifyDependencies = () => {
    console.log(logger.cyan("Checking workspace dependencies..."));
    
    const rootPath = path.resolve(__dirname, "..");
    const paths = [
        path.join(rootPath, "package.json"),
        path.join(rootPath, "server", "package.json"),
        path.join(rootPath, "client", "package.json")
    ];

    const missing = [];

    for (const pkgPath of paths) {
        try {
            const pkg = require(pkgPath);
            const pkgDir = path.dirname(pkgPath);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const dep of Object.keys(deps)) {
                // Ignore self-references or workspaces
                if (dep === "client" || dep === "server") continue;
                
                try {
                    // Try to resolve package.json first to handle ES modules
                    require.resolve(`${dep}/package.json`, { paths: [pkgDir] });
                } catch (e) {
                    try {
                        require.resolve(dep, { paths: [pkgDir] });
                    } catch (err) {
                        if (!missing.includes(dep)) {
                            missing.push(dep);
                        }
                    }
                }
            }
        } catch (e) {
            console.log(logger.yellow(`⚠️ Warning: Could not read package file at ${pkgPath}`));
        }
    }

    if (missing.length > 0) {
        console.log(logger.yellow(`⚠️ Warning: Missing required dependencies: ${missing.join(", ")}`));
        console.log(logger.cyan("Executing 'npm install' to recover dependencies automatically..."));
        
        try {
            execSync("npm install", { stdio: "inherit", cwd: rootPath, shell: true });
            console.log(logger.green("✓ Dependencies successfully installed."));
        } catch (err) {
            console.error(logger.red(`❌ Recovery failed: Failed to install missing packages: ${err.message}`));
            console.error(logger.red("Please execute 'npm install' manually at the root directory."));
            process.exit(1);
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
