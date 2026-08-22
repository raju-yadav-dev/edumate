const { client, collectionName } = require("../server/ai/config/qdrant");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    try {
        const response = await client.scroll(collectionName, {
            limit: 5,
            with_payload: true
        });

        console.log("Qdrant Payloads:");
        response.points.forEach((point, idx) => {
            console.log(`\n--- Point ${idx + 1} (ID: ${point.id}) ---`);
            console.log(JSON.stringify(point.payload, null, 2));
        });

    } catch (err) {
        console.error(err);
    }
}

main().catch(console.error);
