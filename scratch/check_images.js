const mongoose = require("mongoose");
const path = require("path");
const Document = require("../server/models/Document");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const imageDocs = await Document.find({
        status: { $ne: "deleted" },
        mimeType: { $regex: /^image\// }
    }).lean();

    console.log(`Found ${imageDocs.length} image documents in DB:`);
    for (const doc of imageDocs) {
        console.log(`- ID: ${doc._id}`);
        console.log(`  Name: ${doc.originalName}`);
        console.log(`  MimeType: ${doc.mimeType}`);
        console.log(`  EmbeddingStatus: ${doc.embeddingStatus}`);
        console.log(`  Category: ${doc.category}`);
        console.log(`  Metadata:`, JSON.stringify(doc.metadata, null, 2));
        console.log(`----------------------------------------`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
