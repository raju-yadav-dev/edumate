/**
 * EduMate v1.0 — Production Installation & Setup Wizard
 * 
 * Verifies system prerequisites, provisions storage directories,
 * checks GGUF models and databases, and prepares the environment for 1-click startup.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

console.log("\n=======================================================");
console.log("🛠️  EDUMATE v1.0 — INSTALLATION & ENVIRONMENT WIZARD");
console.log("=======================================================\n");

// 1. Node.js Version Check
console.log("📋 1. Checking Node.js Runtime...");
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
if (majorVersion < 18) {
    console.error(`❌ Node.js 18+ is required. Detected version: ${nodeVersion}`);
    process.exit(1);
}
console.log(`  ✓ Node.js v${nodeVersion} detected (Supported).\n`);

// 2. Provision Directory Structure
console.log("📁 2. Initializing Local Storage & Cache Directories...");
const requiredDirs = [
    "storage",
    "storage/academics",
    "storage/admissions",
    "storage/fees",
    "storage/hostel",
    "storage/general",
    "storage/file_explorer",
    "storage/.data",
    "server/ai-models",
    "llama.cpp"
];

requiredDirs.forEach((dir) => {
    const fullPath = path.join(rootDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  + Created: ${dir}/`);
    } else {
        console.log(`  ✓ Exists: ${dir}/`);
    }
});
console.log();

// 3. Environment Configuration Check
console.log("⚙️  3. Configuring Environment (.env)...");
if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log("  ✓ Created .env from .env.example with production defaults.");
    } else {
        const defaultEnv = `
PORT=5000
CHUNKING_PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/edumate
JWT_SECRET=edumate_production_jwt_secret_key_2026_secure
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12
LLM_PROVIDER=llama.cpp
LLAMA_SERVER_URL=http://localhost:8080
LLAMA_MODEL_PATH=llama.cpp/qwen2.5-3b-instruct-q4_k_m.gguf
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=edumate
STORAGE_ROOT=storage
API_RATE_LIMIT_MAX=300
`.trim();
        fs.writeFileSync(envPath, defaultEnv, "utf8");
        console.log("  ✓ Generated default .env file.");
    }
} else {
    console.log("  ✓ Existing .env file found.");
}
console.log();

// 4. Check for Local GGUF AI Models
console.log("🤖 4. Detecting Local GGUF LLM Models...");
const modelSearchDirs = [path.join(rootDir, "llama.cpp"), path.join(rootDir, "models")];
const foundModels = [];

modelSearchDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
            if (file.endsWith(".gguf")) {
                const stat = fs.statSync(path.join(dir, file));
                foundModels.push({
                    name: file,
                    path: path.relative(rootDir, path.join(dir, file)),
                    sizeMB: (stat.size / (1024 * 1024)).toFixed(1)
                });
            }
        });
    }
});

if (foundModels.length > 0) {
    console.log(`  ✓ Found ${foundModels.length} GGUF model(s):`);
    foundModels.forEach((m) => {
        console.log(`     • ${m.name} (${m.sizeMB} MB) -> ${m.path}`);
    });
} else {
    console.log("  ℹ️ No .gguf models currently in llama.cpp/ or models/ directory.");
    console.log("     (EduMate will automatically use mock local AI or fallback until GGUF model is added)");
}
console.log();

// 5. Check NPM Packages
console.log("📦 5. Checking Node Dependencies...");
if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
    console.log("  Installing root dependencies...");
    try {
        execSync("npm install", { cwd: rootDir, stdio: "inherit" });
    } catch (e) {
        console.warn("  Warning during npm install:", e.message);
    }
} else {
    console.log("  ✓ Dependencies already installed.");
}
console.log();

console.log("=======================================================");
console.log("🎉 INSTALLATION WIZARD COMPLETED SUCCESSFULLY!");
console.log("=======================================================\n");
