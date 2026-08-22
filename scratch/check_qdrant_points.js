const { client, collectionName } = require("../server/ai/config/qdrant");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    console.log("Qdrant collection:", collectionName);

    try {
        const response = await client.scroll(collectionName, {
            limit: 50,
            with_payload: true,
            with_vector: false
        });

        console.log(`\nFound ${response.points.length} points in Qdrant scroll:`);
        const documentFiles = new Set();
        response.points.forEach((point, idx) => {
            const filename = point.payload?.originalName || point.payload?.filename || "Unknown";
            documentFiles.add(filename);
            if (idx < 20) {
                console.log(`- Point ${point.id}: filename="${filename}", category="${point.payload?.category}", department="${point.payload?.department}"`);
            }
        });

        console.log("\nAll unique filenames in Qdrant scroll list:");
        console.log(Array.from(documentFiles));

    } catch (err) {
        console.error("Failed to scroll Qdrant:", err);
    }
}

main().catch(console.error);
