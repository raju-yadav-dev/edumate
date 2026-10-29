const fs = require("fs");
const path = require("path");

const rootPath = path.resolve(__dirname, "..");
const envPath = path.join(rootPath, ".env");

// Load bootstrap logic first
const { runBootstrap } = require("./bootstrap");

const runSetup = async () => {
    const { printBanner } = require("./banner");
    printBanner();
    
    // Run bootstrapping steps
    await runBootstrap();
    
    // Load env variables
    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
    }

    const logger = require("./logger");
    const { startQdrantContainer } = require("./dockerManager");
    const { verifyQdrant } = require("./verifyQdrant");
    const { verifyMongo } = require("./verifyMongo");
    const { verifyGemini } = require("./verifyGemini");

    logger.info("\n🚀 Verifying database and AI services...");

    // Start Qdrant container if configured
    await startQdrantContainer();
    
    // Verify Qdrant database status
    const qdrantOk = await verifyQdrant(15);
    if (!qdrantOk) {
        logger.error("❌ Setup failed: Qdrant database service is not responding.");
        process.exit(1);
    }

    // Verify MongoDB
    const mongoOk = await verifyMongo();
    if (!mongoOk) {
        logger.error("❌ Setup failed: MongoDB connection check failed.");
        process.exit(1);
    }



    // Verify Gemini API
    const geminiOk = await verifyGemini();
    if (!geminiOk) {
        logger.error("❌ Setup failed: Google Gemini API connection check failed.");
        process.exit(1);
    }


    console.log("\n" + logger.cyan("============================================================"));
    logger.success("✓ EduMate Setup Completed Successfully!");
    console.log(logger.green("All services are validated and operational."));
    console.log(logger.cyan("To start development run:"));
    console.log(logger.bold(logger.cyan("   npm run dev")));
    console.log(logger.cyan("============================================================\n"));
};

runSetup().catch(err => {
    console.error("Setup execution failed critically:", err);
    process.exit(1);
});
