const { client, collectionName } = require("../server/ai/config/qdrant");
const embeddingService = require("../server/ai/services/embeddingService");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    const query = "eligibility for btech";
    console.log(`Embedding query: "${query}"`);
    const embedding = await embeddingService.getQueryEmbedding(query);

    console.log(`Running Qdrant search for "${query}" (No Filters)...`);
    const results = await client.search(collectionName, {
        vector: embedding,
        limit: 10,
        with_payload: true
    });

    console.log(`\nQdrant Search Results (Count: ${results.length}):`);
    results.forEach((point, idx) => {
        console.log(`[Result ${idx + 1}]`);
        console.log(`  - ID: ${point.id}`);
        console.log(`  - Score: ${point.score}`);
        console.log(`  - Filename: ${point.payload?.originalName || point.payload?.filename}`);
        console.log(`  - Category: ${point.payload?.category}`);
        console.log(`  - Institution: ${point.payload?.institution}`);
        console.log(`  - Content Preview: "${point.payload?.content?.substring(0, 150).replace(/\n/g, " ")}..."`);
    });
}

main().catch(console.error);
