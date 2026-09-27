const fs = require("fs");
const path = require("path");

const rootPath = path.resolve(__dirname, "..");
const envPath = path.join(rootPath, ".env");

// Load env variables
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
}

const logger = require("./logger");
const { stopQdrantContainer, startQdrantContainer } = require("./dockerManager");
const { runClean } = require("./clean");
const { verifyQdrant } = require("./verifyQdrant");

const runReset = async () => {
    logger.info("🔄 Starting EduMate reset sequence...\n");

    // 1. Stop local containers
    stopQdrantContainer();
    console.log();

    // 2. Clean workspace (cache, dist, old node_modules, etc.)
    runClean();
    console.log();

    // 3. Restart Qdrant Container
    const started = await startQdrantContainer();
    if (!started) {
        logger.error("❌ Reset halted: Failed to restart Qdrant container.");
        process.exit(1);
    }
    console.log();

    // Poll Qdrant until healthy
    const healthy = await verifyQdrant(15);
    if (!healthy) {
        logger.error("❌ Reset halted: Qdrant container did not become healthy in time.");
        process.exit(1);
    }
    console.log();

    // 4. Recreate Qdrant Collection
    const { client, collectionName, ensureCollection } = require("../server/ai/config/qdrant");
    try {
        console.log(logger.cyan(`Deleting Qdrant collection: "${collectionName}"...`));
        await client.deleteCollection(collectionName);
        console.log(logger.green(`✓ Deleted collection: "${collectionName}"`));
    } catch (e) {
        console.log(logger.yellow(`⚠️ Note: Collection "${collectionName}" did not exist or could not be deleted directly.`));
    }

    try {
        console.log(logger.cyan(`Recreating Qdrant collection: "${collectionName}"...`));
        await ensureCollection();
        console.log(logger.green(`✓ Recreated collection: "${collectionName}"`));
    } catch (e) {
        logger.error(`❌ Failed to recreate Qdrant collection: ${e.message}`);
        process.exit(1);
    }

    console.log("\n" + logger.cyan("============================================================"));
    logger.success("✓ EduMate environment reset successfully completed!");
    console.log(logger.cyan("You can now start development by running:"));
    console.log(logger.bold(logger.cyan("   npm run dev")));
    console.log(logger.cyan("============================================================\n"));
};

runReset().catch((err) => {
    logger.error(`Reset sequence failed: ${err.message}`);
    process.exit(1);
});
