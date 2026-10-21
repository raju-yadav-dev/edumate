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

const chunkingPort = parseInt(process.env.CHUNKING_PORT || "5001", 10);
const chunkingApiUrl = process.env.CHUNKING_API_URL || `http://127.0.0.1:${chunkingPort}`;

/**
 * Safely coordinate with Chunking Server & Worker Pool before clearing Qdrant.
 * - Inspects active queue/worker state.
 * - Stops worker pool to prevent new jobs from starting.
 * - Drains in-flight jobs until active worker count is strictly 0.
 * - If worker coordination cannot be guaranteed or drain times out, aborts cleanup.
 * 
 * @returns {Promise<{ coordinated: boolean, reason?: string, serverRunning: boolean }>}
 */
async function coordinateWorkerPool() {
    logger.step(`Checking chunking server and worker status at ${logger.bold(chunkingApiUrl)}...`);

    let queueData = null;
    let serverRunning = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${chunkingApiUrl}/queue`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
            const json = await res.json();
            queueData = json.data;
            serverRunning = true;
        }
    } catch (_) {
        serverRunning = false;
    }

    if (!serverRunning) {
        logger.info(`ℹ️ Chunking server is not running on port ${chunkingPort}.`);

        // Check MongoDB directly to ensure no dangling active processing state
        try {
            const mongoose = require("mongoose");
            const mongoUri = process.env.MONGODB_URI;
            if (mongoUri && mongoose.connection.readyState !== 1) {
                await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
                const Document = require("../server/models/Document");
                const processingDocs = await Document.countDocuments({
                    status: "active",
                    embeddingStatus: { $in: ["processing", "Processing"] }
                });

                if (processingDocs > 0) {
                    await mongoose.disconnect();
                    return {
                        coordinated: false,
                        reason: `Detected ${processingDocs} document(s) marked as 'processing' in MongoDB without an active chunking server. Please resolve in-flight jobs before cleaning.`,
                        serverRunning: false
                    };
                }
                await mongoose.disconnect();
            }
        } catch (_) {}

        logger.success("✓ Confirmed no live worker pool is running.");
        return { coordinated: true, serverRunning: false };
    }

    // Chunking server IS running
    const activeWorkers = queueData.activeWorkers || [];
    const activeJobs = queueData.activeJobs || [];
    const queuedCount = queueData.totalQueued || queueData.stats?.queued || 0;
    const workerStatus = (queueData.workerStatus || "RUNNING").toUpperCase();

    logger.info(`   Server Status: ${logger.bold(workerStatus)} | Active Workers: ${logger.bold(String(activeJobs.length || activeWorkers.length))} | Queued: ${queuedCount}`);

    // Step A: Send worker stop command to lock pipeline and stop picking up queued jobs
    logger.step("Stopping worker pool to lock pipeline against re-indexing...");
    try {
        const stopRes = await fetch(`${chunkingApiUrl}/worker/stop`, { method: "POST" });
        if (!stopRes.ok) {
            return {
                coordinated: false,
                reason: `Failed to stop worker pool via API: HTTP ${stopRes.status}`,
                serverRunning: true
            };
        }
    } catch (stopErr) {
        return {
            coordinated: false,
            reason: `Failed to communicate with worker API: ${stopErr.message}`,
            serverRunning: true
        };
    }

    // Step B: Drain in-flight jobs if any are active
    const inFlightCount = activeJobs.length || activeWorkers.length;
    if (inFlightCount > 0) {
        logger.warn(`⚠️ ${inFlightCount} job(s) currently active. Waiting for workers to safely drain...`);
        const maxDrainSeconds = 45;
        const drainStart = Date.now();
        let drained = false;

        while ((Date.now() - drainStart) < maxDrainSeconds * 1000) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                const pollRes = await fetch(`${chunkingApiUrl}/queue`);
                if (pollRes.ok) {
                    const pollJson = await pollRes.json();
                    const remainingActive = (pollJson.data?.activeJobs || []).length || (pollJson.data?.activeWorkers || []).length;
                    if (remainingActive === 0) {
                        drained = true;
                        break;
                    }
                    const elapsed = Math.round((Date.now() - drainStart) / 1000);
                    logger.info(`   Waiting for workers to drain (${remainingActive} remaining, ${elapsed}s elapsed)...`);
                }
            } catch (_) {}
        }

        if (!drained) {
            return {
                coordinated: false,
                reason: `Worker drain timed out after ${maxDrainSeconds}s. Active jobs are still running.`,
                serverRunning: true
            };
        }
    }

    // Step C: Verify zero active workers and pipeline locked
    try {
        const verifyRes = await fetch(`${chunkingApiUrl}/queue`);
        if (verifyRes.ok) {
            const verifyJson = await verifyRes.json();
            const verifyActive = (verifyJson.data?.activeJobs || []).length || (verifyJson.data?.activeWorkers || []).length;
            const verifyStatus = (verifyJson.data?.workerStatus || "").toUpperCase();

            if (verifyActive > 0) {
                return {
                    coordinated: false,
                    reason: `Safety check failed: ${verifyActive} job(s) are still active.`,
                    serverRunning: true
                };
            }

            if (verifyStatus !== "STOPPED" && verifyStatus !== "PAUSED") {
                return {
                    coordinated: false,
                    reason: `Safety check failed: Worker status is '${verifyStatus}' instead of STOPPED/PAUSED.`,
                    serverRunning: true
                };
            }
        }
    } catch (err) {
        return {
            coordinated: false,
            reason: `Failed to verify final worker state: ${err.message}`,
            serverRunning: true
        };
    }

    logger.success("✓ Worker pool stopped and drained successfully. Pipeline is locked.");
    return { coordinated: true, serverRunning: true };
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

    // Step 5: Coordinate with Worker Pool to ensure no active or starting jobs
    const coordResult = await coordinateWorkerPool();
    if (!coordResult.coordinated) {
        logger.error(`\n❌ CLEANUP ABORTED: ${coordResult.reason}`);
        logger.warn("   Qdrant vectors were NOT deleted because safe worker coordination could not be guaranteed.");
        logger.warn("   Aborting cleanup to prevent vector corruption and inconsistent state.\n");
        process.exitCode = 1;
        return;
    }

    // Step 6: Delete all points from collection using supported Qdrant API
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

    // Step 7: Verify collection has 0 points and preserved schema
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
            return;
        }
    } catch (err) {
        logger.error(`\n❌ Post-deletion verification error: ${err.message}\n`);
        process.exitCode = 1;
        return;
    }

    // Step 8: Post-cleanup worker state management
    // Workers remain STOPPED to prevent automatic re-indexing, unless explicitly confirmed via --resume
    try {
        const paths = require("../server/config/paths");
        paths.ensureAllDirectories();
        const shouldResume = process.argv.includes("--resume") || process.env.RESUME_AFTER_CLEAN === "true";

        if (coordResult.serverRunning && shouldResume) {
            logger.step("Explicit resume flag detected: Resuming worker pool...");
            try {
                await fetch(`${chunkingApiUrl}/worker/start`, { method: "POST" });
                logger.success("✓ Worker pool resumed.");
            } catch (resErr) {
                logger.warn(`⚠️ Could not resume worker pool: ${resErr.message}`);
            }
        } else {
            fs.writeFileSync(
                path.join(paths.DATA_ROOT, "worker_state.json"),
                JSON.stringify({ state: "STOPPED", updatedAt: new Date().toISOString() }, null, 2),
                "utf-8"
            );
            logger.info("🔒 Worker pool remains STOPPED across restarts to prevent automatic re-indexing into Qdrant.");
            logger.info("   To resume indexing when ready, click 'Start Worker' in Chunking Studio or run: POST /worker/start\n");
        }
    } catch (_) {}
}

if (require.main === module) {
    cleanStudio().catch((err) => {
        logger.error(`\nUnexpected error in clean-studio: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { cleanStudio };
