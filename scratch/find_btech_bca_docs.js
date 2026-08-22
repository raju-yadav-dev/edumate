const mongoose = require("mongoose");
const path = require("path");
const Document = require("../server/models/Document");
const Chunk = require("../server/models/Chunk");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const docs = await Document.find({
        status: { $ne: "deleted" }
    }).lean();

    console.log(`\nFound ${docs.length} active documents in MongoDB:`);
    for (const doc of docs) {
        const chunkCount = await Chunk.countDocuments({ document: doc._id });
        console.log(`- ID: ${doc._id}`);
        console.log(`  Name: ${doc.originalName}`);
        console.log(`  Stored Name: ${doc.storedName}`);
        console.log(`  MimeType: ${doc.mimeType}`);
        console.log(`  EmbeddingStatus: ${doc.embeddingStatus}`);
        console.log(`  Category: ${doc.category}`);
        console.log(`  Institution: ${doc.institution}`);
        console.log(`  Department: ${doc.department}`);
        console.log(`  Chunk Count: ${chunkCount}`);
        console.log(`----------------------------------------`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
