const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const rootPath = path.resolve(__dirname, "..");

const pathsToRemove = [
    path.join(rootPath, "client", "dist"),
    path.join(rootPath, "client", "node_modules"),
    path.join(rootPath, "client", "package-lock.json"),
    path.join(rootPath, "server", "node_modules"),
    path.join(rootPath, "server", "package-lock.json"),
    path.join(rootPath, "server", "uploads", "*") // we will clean contents of uploads
];

const cleanLogsAndTemp = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file === "node_modules" || file === ".git" || file === "dist") continue;
            cleanLogsAndTemp(filePath);
        } else {
            if (file.endsWith(".log") || file === "npm-debug.log" || file === ".eslintcache") {
                try {
                    fs.unlinkSync(filePath);
                    console.log(logger.green(`✓ Removed log/cache file: ${filePath}`));
                } catch (e) {
                    console.log(logger.yellow(`⚠️ Failed to remove: ${filePath} (${e.message})`));
                }
            }
        }
    }
};

const runClean = () => {
    logger.info("🧹 Starting workspace cleanup sequence...\n");

    for (const p of pathsToRemove) {
        if (p.endsWith("*")) {
            // Clean contents of directory
            const dir = p.slice(0, -2);
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    try {
                        fs.rmSync(filePath, { recursive: true, force: true });
                        console.log(logger.green(`✓ Cleaned temporary upload: ${filePath}`));
                    } catch (e) {
                        console.log(logger.yellow(`⚠️ Failed to clean: ${filePath} (${e.message})`));
                    }
                }
            }
        } else {
            // Delete folder/file directly
            if (fs.existsSync(p)) {
                try {
                    fs.rmSync(p, { recursive: true, force: true });
                    console.log(logger.green(`✓ Removed: ${p}`));
                } catch (e) {
                    console.log(logger.yellow(`⚠️ Failed to remove: ${p} (${e.message})`));
                }
            }
        }
    }

    // Clean log files recursively
    cleanLogsAndTemp(rootPath);

    logger.success("\n✓ Workspace cleanup completed successfully.");
};

if (require.main === module) {
    runClean();
}

module.exports = { runClean };
