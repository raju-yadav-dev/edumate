const path = require("path");
const mongoose = require("mongoose");

// Load .env from server
const envPath = path.join(__dirname, "server", ".env");
require("dotenv").config({ path: envPath });

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI is not set in env at path:", envPath);
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Mongo connected!");
    
    const Document = require("./server/models/Document");
    
    const docs = await Document.find({ embeddingStatus: "failed" }).lean();
    console.log(`Found ${docs.length} failed embedding documents:`);
    
    for (const doc of docs) {
        console.log(`\nDocument: "${doc.originalName}" (${doc._id})`);
        console.log(`Embedding Status: ${doc.embeddingStatus}`);
        console.log(`Metadata:`, JSON.stringify(doc.metadata, null, 2));
    }
    
    await mongoose.disconnect();
}

run().catch(console.error);
