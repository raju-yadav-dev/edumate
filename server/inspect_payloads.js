const { client, collectionName } = require("./ai/config/qdrant");

async function run() {
    try {
        console.log("Scrolling 5 points to inspect payloads...");
        const res = await client.scroll(collectionName, {
            limit: 5,
            with_payload: true,
            with_vector: false
        });
        res.points.forEach((p, idx) => {
            console.log(`\n--- Point ${idx + 1} (ID: ${p.id}) ---`);
            console.log(JSON.stringify(p.payload, null, 2));
        });
    } catch (e) {
        console.error("Failed:", e);
    }
}

run();
