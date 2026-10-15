#!/usr/bin/env node

/**
 * EduMate Studio - Clear Vectors Command
 * Safely removes all vector chunks from the configured Qdrant collection
 * while strictly preserving the collection schema, dimensions, and configurations.
 * 
 * Never touches MongoDB, uploaded PDFs, local chunks, caches, backups, logs, or Docker.
 */

const path = require("path");
const fs = require("fs");
const readline = require("readline");

// Load environment variables before requiring Qdrant config
const projectRoot = path.resolve(__dirname, "..");
[
    path.join(projectRoot, ".env"),
    path.join(projectRoot, "server", ".env")
].forEach((envPath) => {
    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath, override: true });
    }
});

const logger = require("./logger");
const { client, collectionName } = require("../server/ai/config/qdrant");

const qdrantUrl = process.env.QDRANT_URL || "http://127.0.0.1:6333";

/**
 * Prompt user for confirmation input via readline interface
 * @param {string} promptMessage
 * @returns {Promise<string>}
 */
function promptUser(promptMessage) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(promptMessage, (answer) => {
            rl.close();
            resolve(answer ? answer.trim() : "");
        });
    });
}

/**
 * Helper to display vector parameters cleanly
 * @param {object} vectorsConfig
 * @returns {string}
 */
function describeVectorsConfig(vectorsConfig) {
    if (!vectorsConfig) return "Unknown";
    if (vectorsConfig.size && vectorsConfig.distance) {
        return `Dimension: ${vectorsConfig.size}, Distance: ${vectorsConfig.distance}`;
    }
    if (typeof vectorsConfig === "object") {
        return Object.entries(vectorsConfig)
            .map(([name, conf]) => `"${name}" (Dim: ${conf.size}, Distance: ${conf.distance})`)
            .join("; ");
    }
    return JSON.stringify(vectorsConfig);
}

async function cleanStudio() {
    console.log(logger.cyan("============================================================"));
    console.log(logger.bold(logger.cyan("          EduMate Studio - Qdrant Vector Cleanup            ")));
    console.log(logger.cyan("============================================================\n"));

    // Step 1: Connect and check Qdrant availability
    logger.step(`Connecting to Qdrant at ${logger.bold(qdrantUrl)}...`);

    let collectionsList;
    try {
        const res = await client.getCollections();
        collectionsList = res.collections || [];
        logger.success("✓ Connected to Qdrant successfully.");
    } catch (err) {
        logger.error(`\n❌ Connection failed: Unable to reach Qdrant at ${qdrantUrl}.`);
        logger.warn(`   Error: ${err.message}`);
        logger.warn("   Please ensure Qdrant is running and that your network/URL settings are correct.\n");
        process.exitCode = 1;
        return;
    }

    // Step 2: Verify target collection exists
    const collectionExists = collectionsList.some((c) => c.name === collectionName);
    if (!collectionExists) {
        logger.warn(`\n⚠️ Collection "${collectionName}" was not found in Qdrant.`);
        const available = collectionsList.map((c) => c.name).join(", ");
        logger.info(`   Available collections: ${available || "none"}`);
        logger.success("✓ No action needed. Collection is absent.\n");
        return;
    }

    // Step 3: Get current collection details & vector count
    let collectionInfo;
    let initialCount = 0;
    try {
        collectionInfo = await client.getCollection(collectionName);
        const countRes = await client.count(collectionName, { exact: true });
        initialCount = countRes.count ?? collectionInfo.points_count ?? 0;
    } catch (err) {
        logger.error(`\n❌ Failed to retrieve information for collection "${collectionName}": ${err.message}\n`);
        process.exitCode = 1;
        return;
    }

    const vectorsConfig = collectionInfo.config?.params?.vectors;
    const vectorsDescription = describeVectorsConfig(vectorsConfig);

    console.log(logger.cyan("\n--- Target Collection Status ---"));
    console.log(`  Collection Name   : ${logger.bold(logger.cyan(collectionName))}`);
    console.log(`  Current Points    : ${logger.bold(initialCount > 0 ? logger.yellow(String(initialCount)) : logger.green("0"))}`);
    console.log(`  Vector Config     : ${logger.bold(vectorsDescription)}`);
    console.log(`  Status            : ${collectionInfo.status || "green"}`);
    console.log(logger.cyan("--------------------------------\n"));

    if (initialCount === 0) {
        logger.success(`✓ Collection "${collectionName}" already contains 0 points. Nothing to clear.\n`);
        return;
    }

    // Step 4: Require explicit confirmation by typing CLEAR
    logger.warn(`⚠️ WARNING: This will permanently delete all ${initialCount} vector point(s) from collection "${collectionName}".`);
    console.log(logger.gray("   (Collection schema, dimensions, metric, MongoDB, and local files will NOT be affected)\n"));

    let confirmation;
    if (process.argv.includes("--confirm=CLEAR") || process.env.CONFIRM_CLEAR === "CLEAR") {
        logger.info("Confirmation flag detected: Proceeding with CLEAR.");
        confirmation = "CLEAR";
    } else {
        confirmation = await promptUser(
            logger.bold(logger.yellow(`Type CLEAR to confirm deletion: `))
        );
    }

    if (confirmation !== "CLEAR") {
        logger.warn(`\n⚠️ Aborted: Confirmation did not match "CLEAR". Received: "${confirmation}".`);
        logger.warn("   No points or vectors were deleted.\n");
        return;
    }

    // Step 5: Delete all points from collection using supported Qdrant API
    logger.step(`Deleting all points from collection "${collectionName}"...`);
    try {
        await client.delete(collectionName, {
            wait: true,
            filter: {}
        });
    } catch (err) {
        logger.error(`\n❌ Deletion failed: Could not delete points from collection "${collectionName}".`);
        logger.error(`   Error: ${err.message}\n`);
        process.exitCode = 1;
        return;
    }

    // Step 6: Verify collection has 0 points and preserved schema
    logger.step(`Verifying collection status...`);
    try {
        const verifyCountRes = await client.count(collectionName, { exact: true });
        const remainingCount = verifyCountRes.count ?? 0;

        const verifiedInfo = await client.getCollection(collectionName);
        const verifiedVectorsConfig = verifiedInfo.config?.params?.vectors;

        if (remainingCount === 0) {
            logger.success(`\n✓ SUCCESS: All points successfully cleared from collection "${collectionName}".`);
            logger.success(`✓ Verified remaining points: 0`);
            logger.success(`✓ Collection "${collectionName}" preserved: ${describeVectorsConfig(verifiedVectorsConfig)}`);
            console.log(logger.cyan("============================================================\n"));
        } else {
            logger.error(`\n❌ Verification failed: ${remainingCount} points still remain in collection "${collectionName}".\n`);
            process.exitCode = 1;
        }
    } catch (err) {
        logger.error(`\n❌ Post-deletion verification error: ${err.message}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    cleanStudio().catch((err) => {
        logger.error(`\nUnexpected error in clean-studio: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { cleanStudio };
