const { client, collectionName, ensureCollection } = require("../server/ai/config/qdrant");
const logger = require("./logger");

/**
 * Connects to Qdrant and polls until healthy, verifying target collection state
 * @param {number} [maxAttempts=10]
 * @returns {Promise<boolean>}
 */
const verifyQdrant = async (maxAttempts = 10) => {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    console.log(logger.cyan(`Connecting to Qdrant service at: ${url}...`));

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
            console.log(logger.yellow(`⚠️ Qdrant status check: Connection attempt ${attempts}/${maxAttempts} failed. Retrying in 2 seconds...`));
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
