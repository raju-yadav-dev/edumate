const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Document = require("./server/models/Document");
    const docs = await Document.find({ status: "active" }).lean();
    console.log(`Total active docs: ${docs.length}`);
    docs.forEach((doc, idx) => {
        console.log(`${idx + 1}. [${doc._id}] "${doc.originalName}" | Status: ${doc.embeddingStatus} | chunkCount: ${doc.chunkCount} | Error: ${doc.metadata?.error || 'None'}`);
    });
    await mongoose.disconnect();
}

run().catch(console.error);
