const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootPath = path.resolve(__dirname, "..");
const envPath = path.join(rootPath, ".env");
const envExamplePath = path.join(rootPath, ".env.example");

// Try to load env
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
}

const logger = require("./logger");
const { verifyNodeVersion, verifyNpmVersion, verifyDependencies } = require("./dependencyChecker");
const { verifyEnvironment } = require("./verifyEnvironment");
const { verifyMongo } = require("./verifyMongo");
const { verifyStorage } = require("./verifyStorage");
const { verifyGroq } = require("./verifyGroq");
const { verifyQdrant } = require("./verifyQdrant");
const { checkInternet } = require("./healthCheck");
const { printBanner } = require("./banner");

const runDoctor = async () => {
    printBanner();
    logger.info("💉 Starting EduMate Doctor Diagnostics Checklist...\n");
    
    let hasErrors = false;

    // 1. Verify Node.js
    try {
        verifyNodeVersion();
    } catch (e) {
        hasErrors = true;
    }
    console.log();

    // 2. Verify npm
    try {
        verifyNpmVersion();
    } catch (e) {
        hasErrors = true;
    }
    console.log();

    // 3. Verify Internet Connection
    await checkInternet();
    console.log();

    // 4. Verify env configurations (with automatic copy fix)
    if (!fs.existsSync(envPath)) {
        logger.warn("⚠️ Warning: .env file is missing at root.");
        if (fs.existsSync(envExamplePath)) {
            logger.cyan("🔧 Automatic Fix: Copying .env.example to .env...");
            fs.copyFileSync(envExamplePath, envPath);
            logger.success("✓ Created .env file from template.");
            // reload env
            require("dotenv").config({ path: envPath });
        } else {
            logger.error("❌ Error: .env.example template is missing at root.");
            hasErrors = true;
        }
    }

    const envOk = verifyEnvironment();
    if (!envOk) {
        hasErrors = true;
    }
    console.log();

    // 5. Verify dependencies (with automatic recover fix)
    try {
        verifyDependencies();
    } catch (e) {
        hasErrors = true;
    }
    console.log();

    if (envOk) {
        // 6. Verify MongoDB connectivity
        const mongoOk = await verifyMongo();
        if (!mongoOk) {
            hasErrors = true;
            logger.warn("💡 Suggestion: Confirm MONGODB_URI is correct and your IP is whitelisted on MongoDB Atlas / local MongoDB is running.");
        }
        console.log();

        // 7. Verify Local Storage Root
        const storageOk = await verifyStorage();
        if (!storageOk) {
            hasErrors = true;
            logger.warn("💡 Suggestion: Ensure the storage/ folder has read and write permissions.");
        }
        console.log();

        // 8. Verify AI / LLM Provider connectivity
        const provider = (process.env.LLM_PROVIDER || "llama.cpp").toLowerCase();
        let aiOk = true;
        if (provider === "groq") {
            aiOk = await verifyGroq();
            if (!aiOk) {
                hasErrors = true;
                logger.warn("💡 Suggestion: Confirm GROQ_API_KEY is active and correct in settings or environment.");
            }
        } else if (provider === "gemini") {
            const { verifyGemini } = require("./verifyGemini");
            aiOk = await verifyGemini();
            if (!aiOk) {
                hasErrors = true;
                logger.warn("💡 Suggestion: Confirm GEMINI_API_KEY is active and correct in settings or environment.");
            }
        } else {
            // Local llama.cpp
            const { getLlmConfig, inspectModelFile } = require("../server/config/llm");
            const config = getLlmConfig();
            const modelInspection = inspectModelFile(config.modelPath, config.model);
            if (!modelInspection.exists) {
                logger.error(`❌ Local LLM model file not found: ${config.model}`);
                hasErrors = true;
            } else {
                logger.success(`✓ Local LLM model found (${config.model}, ${modelInspection.sizeFormatted})`);
            }
        }
        console.log();

        // 9. Verify Qdrant connectivity and collection setup (with auto-create fix)
        const qdrantOk = await verifyQdrant(2); // check only twice for quick diagnostics
        if (!qdrantOk) {
            hasErrors = true;
            logger.warn("\n💡 Suggestion: Ensure Qdrant container is running. Try executing:");
            logger.info("   npm run dev (to automatically boot and initialize it)");
        }
    }

    console.log("\n" + logger.cyan("============================================================"));
    if (hasErrors) {
        logger.error("❌ EduMate Doctor found issues with your development environment.");
        logger.warn("Please resolve the warnings/errors above and rerun 'npm run doctor'.");
        process.exit(1);
    } else {
        logger.success("✓ Diagnostics completed. Your development environment is healthy and ready!");
    }
    console.log(logger.cyan("============================================================\n"));
};

runDoctor().catch((err) => {
    console.error("Doctor script execution failed:", err);
    process.exit(1);
});
