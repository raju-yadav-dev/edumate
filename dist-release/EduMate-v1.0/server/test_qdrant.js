const path = require("path");
require("dotenv").config();
const { client, collectionName, ensureCollection } = require("./ai/config/qdrant");

async function run() {
    try {
        console.log("Ensuring collection...");
        await ensureCollection();
        console.log("CollectionName:", collectionName);

        const info = await client.getCollection(collectionName);
        console.log("Collection Info:", JSON.stringify(info, null, 2));

        console.log("Scrolling 1 point...");
        const scrollRes = await client.scroll(collectionName, {
            limit: 1,
            with_payload: true,
            with_vector: true
        });
        console.log("Scroll points count:", scrollRes.points.length);
        if (scrollRes.points.length > 0) {
            const point = scrollRes.points[0];
            console.log("Point ID:", point.id);
            console.log("Vector type:", typeof point.vector);
            console.log("Vector isArray:", Array.isArray(point.vector));
            if (typeof point.vector === "object" && !Array.isArray(point.vector)) {
                console.log("Vector keys:", Object.keys(point.vector));
            }
        }

        console.log("Testing search with plain array...");
        const embedding = new Array(768).fill(0.1);
        try {
            const res = await client.search(collectionName, {
                vector: embedding,
                limit: 1
            });
            console.log("Search with plain array SUCCEEDED, count:", res.length);
        } catch (e) {
            console.log("Search with plain array FAILED:", e.message);
        }

        console.log("Testing search with named vector object { name: 'default', vector: ... }...");
        try {
            const res = await client.search(collectionName, {
                vector: {
                    name: "default",
                    vector: embedding
                },
                limit: 1
            });
            console.log("Search with named vector SUCCEEDED, count:", res.length);
        } catch (e) {
            console.log("Search with named vector FAILED:", e.message);
        }

    } catch (e) {
        console.error("Execution failed:", e);
    }
}

run();
