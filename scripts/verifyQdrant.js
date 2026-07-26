const { client, collectionName, ensureCollection } = require("../server/ai/config/qdrant");
const logger = require("./logger");

/**
 * Connects to Qdrant and polls until healthy, verifying target collection state
 * @param {number} [maxAttempts=10]
 * @returns {Promise<boolean>}
 */
const verifyQdrant = async (maxAttempts = 10) => {
    const url = process.env.QDRANT_URL || "http://127.0.0.1:6333";
    console.log(logger.cyan(`Connecting to Qdrant service at: ${url}...`));

    // Run diagnostics once
    try {
        const dns = require("dns").promises;
        const localhostLookups = await dns.lookup("localhost", { all: true }).catch(e => `Failed: ${e.message}`);
        console.log(logger.cyan(`  [Diagnostic] DNS lookup for "localhost": ${JSON.stringify(localhostLookups)}`));
        console.log(logger.cyan(`  [Diagnostic] Proxy envs: http_proxy=${process.env.http_proxy || "none"}, https_proxy=${process.env.https_proxy || "none"}, no_proxy=${process.env.no_proxy || "none"}`));
    } catch (diagErr) {
        console.log(logger.yellow(`  [Diagnostic] Failed to gather diagnostics: ${diagErr.message}`));
    }

    let attempts = 0;
    while (attempts < maxAttempts) {
        attempts++;
        try {
            // Check connectivity by requesting collection list
            await client.getCollections();
            console.log(logger.green("✓ Successfully connected to Qdrant database."));

            // Verify and auto-create the collection
            await ensureCollection();
            return true;
        } catch (err) {
            console.log(logger.yellow(`⚠️ Qdrant status check: Connection attempt ${attempts}/${maxAttempts} failed.`));
            console.log(logger.yellow(`  Error Name: ${err.name}`));
            console.log(logger.yellow(`  Error Message: ${err.message}`));
            if (err.cause) {
                console.log(logger.yellow(`  Error Cause: ${err.cause.message || err.cause}`));
            }
            if (err.stack) {
                console.log(logger.yellow(`  Stack: ${err.stack.split("\n").slice(0, 3).join("\n")}`));
            }
            if (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    console.error(logger.red("❌ Error: Qdrant vector database is unreachable. Verify Docker status or manual execution configurations."));
    return false;
};

module.exports = {
    verifyQdrant
};
