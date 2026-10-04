const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function debugRetrieval() {
    const { client, collectionName } = require("../server/ai/config/qdrant");
    const { embedText } = require("../server/ai/config/embeddings");
    const { planQuery } = require("../server/ai/utils/queryPlanner");
    const { buildPlannerQdrantFilter } = require("../server/ai/services/retrievalService");

    const query = "engineering building";
    const vector = await embedText(query, { task: "retrieval.query" });
    const queryPlan = planQuery(query);
    console.log("Query Plan:", JSON.stringify(queryPlan, null, 2));

    const filter = buildPlannerQdrantFilter({ queryPlan, user: { institution: "all" } });
    console.log("Built Filter:", JSON.stringify(filter, null, 2));

    // Test search with filter
    try {
        console.log("Testing search WITH filter...");
        const resWithFilter = await client.search(collectionName, {
            vector: vector,
            limit: 5,
            filter: filter,
            with_payload: true
        });
        console.log("Search with filter success! Results count:", resWithFilter.length);
    } catch (e) {
        console.error("Search with filter failed:", e.message);
        if (e.data) console.error("Error data:", JSON.stringify(e.data));
    }

    // Test search WITHOUT filter
    try {
        console.log("\nTesting search WITHOUT filter...");
        const resNoFilter = await client.search(collectionName, {
            vector: vector,
            limit: 5,
            with_payload: true
        });
        console.log("Search without filter success! Results count:", resNoFilter.length);
        if (resNoFilter.length > 0) {
            console.log("Sample result payload:", resNoFilter[0].payload);
        }
    } catch (e) {
        console.error("Search without filter failed:", e.message);
    }
}

debugRetrieval().catch(console.error);
