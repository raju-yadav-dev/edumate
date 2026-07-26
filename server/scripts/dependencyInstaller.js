const { execSync } = require("child_process");
const colors = require("./colors");

/**
 * Validates Node.js runtime version is >= 18 (required for native global fetch)
 */
const verifyNodeVersion = () => {
    const version = process.versions.node;
    const major = parseInt(version.split(".")[0], 10);

    if (major < 18) {
        console.error(colors.red(`❌ Error: Node.js version ${version} is too old. EduMate requires Node.js version >= 18.0.0 for built-in fetch support.`));
        process.exit(1);
    }
    console.log(colors.green(`✓ Node.js version validated: v${version}`));
};

/**
 * Checks and installs missing npm dependencies defined in package.json
 */
const verifyDependencies = () => {
    console.log(colors.cyan("Checking project dependencies..."));
    
    const requiredDeps = [
        "@qdrant/js-client-rest",
        "pdf-parse",
        "mongoose",
        "express",
        "jsonwebtoken",
        "dotenv"
    ];

    const missing = [];
    for (const dep of requiredDeps) {
        try {
            require.resolve(dep);
        } catch (e) {
            missing.push(dep);
        }
    }

    if (missing.length > 0) {
        console.log(colors.yellow(`⚠️ Warning: Missing required dependencies: ${missing.join(", ")}`));
        console.log(colors.cyan("Executing 'npm install' to recover dependencies automatically..."));
        
        try {
            execSync("npm install", { stdio: "inherit", cwd: process.cwd() });
            console.log(colors.green("✓ Dependencies successfully installed."));
        } catch (err) {
            console.error(colors.red(`❌ Recovery failed: Failed to install missing packages: ${err.message}`));
            console.error(colors.red("Please execute 'npm install' manually on your terminal, then restart the launcher."));
            process.exit(1);
        }
    } else {
        console.log(colors.green("✓ All required npm dependencies verified."));
    }
};

module.exports = {
    verifyNodeVersion,
    verifyDependencies
};
