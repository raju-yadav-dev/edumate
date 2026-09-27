const fs = require("fs");
const path = require("path");

const rootPath = path.resolve(__dirname, "..");

const filesToRemove = [
    path.join(rootPath, "server", "scripts"),
    path.join(rootPath, "server", "docker-compose.yml"),
    path.join(rootPath, "server", "node_modules"),
    path.join(rootPath, "client", "node_modules"),
    path.join(rootPath, "server", "package-lock.json"),
    path.join(rootPath, "client", "package-lock.json")
];

console.log("Starting cleanup of old files...");

for (const p of filesToRemove) {
    if (fs.existsSync(p)) {
        try {
            fs.rmSync(p, { recursive: true, force: true });
            console.log(`✓ Removed: ${p}`);
        } catch (e) {
            console.error(`❌ Failed to remove: ${p} (${e.message})`);
        }
    } else {
        console.log(`- Already removed/does not exist: ${p}`);
    }
}

console.log("Cleanup finished.");
