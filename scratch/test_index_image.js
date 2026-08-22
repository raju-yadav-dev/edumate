const mongoose = require("mongoose");
const path = require("path");
const indexingService = require("../server/ai/services/indexingService");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const documentId = "6a8295c3b042fe93196a57cd";
    console.log(`Running indexing job for document ${documentId}...`);
    try {
        await indexingService.runIndexingJob(documentId);
        console.log("Job completed successfully!");
    } catch (err) {
        console.error("Job failed with error:", err);
        if (err.stack) {
            console.error("Stack trace:", err.stack);
        }
    }

    await mongoose.disconnect();
}

main().catch(console.error);
