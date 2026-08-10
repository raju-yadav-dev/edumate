const { client, collectionName, ensureCollection } = require("../ai/config/qdrant");
const colors = require("./colors");

/**
 * Connects to Qdrant and polls until healthy, verifying target collection state
 * @param {number} [maxAttempts=10]
 * @returns {Promise<boolean>}
 */
const verifyQdrant = async (maxAttempts = 10) => {
    const url = process.env.QDRANT_URL || "http://127.0.0.1:6333";
    console.log(colors.cyan(`Connecting to Qdrant service at: ${url}...`));

    let attempts = 0;
    while (attempts < maxAttempts) {
        attempts++;
        try {
            // Check connectivity by requesting collection list
            await client.getCollections();
            console.log(colors.green("✓ Successfully connected to Qdrant database."));

            // Verify and auto-create the collection
            await ensureCollection();
            return true;
        } catch (err) {
            if (err.message.includes("dimension mismatch") || err.message.includes("validation failed")) {
                console.error(colors.red(`❌ Startup blocked: ${err.message}`));
                process.exit(1);
            }
            console.log(colors.yellow(`⚠️ Qdrant status check: Connection attempt ${attempts}/${maxAttempts} failed: ${err.message}. Retrying in 2 seconds...`));
            if (attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    console.error(colors.red("❌ Error: Qdrant vector database is unreachable. Verify Docker status or manual execution configurations."));
    return false;
};

module.exports = {
    verifyQdrant
};
