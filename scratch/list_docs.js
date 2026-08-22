const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB!");
    const Document = require("../server/models/Document");
    const docs = await Document.find({}).lean();
    console.log(`Total documents found: ${docs.length}`);
    for (const d of docs) {
        console.log(`- ID: ${d._id}`);
        console.log(`  Name: ${d.originalName}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  EmbeddingStatus: ${d.embeddingStatus}`);
        console.log(`  Category: ${d.category}`);
        console.log(`  MimeType: ${d.mimeType}`);
        console.log(`  Metadata:`, JSON.stringify(d.metadata, null, 2));
    }
    await mongoose.disconnect();
}

main().catch(console.error);
