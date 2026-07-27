require("dotenv").config();
const mongoose = require("mongoose");
const { rebuildAllEmbeddings } = require("./ai/services/indexingService");

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected successfully.");

        console.log("Triggering reindexing for all documents...");
        const result = await rebuildAllEmbeddings();
        console.log(`Successfully triggered indexing for ${result.count} documents in background.`);

        // Wait a few seconds for background indexing tasks to finish
        console.log("Waiting 10 seconds for tasks to complete...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log("Done.");
    } catch (err) {
        console.error("Error running reindex script:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
