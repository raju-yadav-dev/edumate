const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

// Load .env
const envPath = path.join(__dirname, ".env");
require("dotenv").config({ path: envPath });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Mongo connected!");
    
    const Document = require("./server/models/Document");
    const indexingService = require("./server/ai/services/indexingService");
    
    const docs = await Document.find({ status: "active", mimeType: "application/pdf" });
    console.log(`Ingesting and indexing ${docs.length} active documents sequentially...`);
    
    for (const doc of docs) {
        console.log(`\nIndexing: "${doc.originalName}" (${doc._id})...`);
        try {
            await indexingService.indexDocumentBackground(doc._id);
            const updatedDoc = await Document.findById(doc._id).lean();
            console.log(`Status: ${updatedDoc.embeddingStatus}, chunkCount: ${updatedDoc.chunkCount}`);
        } catch (err) {
            console.error(`Index failed:`, err.message);
        }
    }
    
    await mongoose.disconnect();
    console.log("\nReindexing complete.");
}

run().catch(console.error);
