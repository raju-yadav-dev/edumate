const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const Document = require("../server/models/Document");
    const docs = await Document.find({ status: "active", embeddingStatus: "indexed" }).lean();

    console.log(`\nFound ${docs.length} active indexed documents:`);
    docs.forEach(doc => {
        if (doc.metadata?.academicEntities?.length > 0) {
            console.log(`\n- Document: "${doc.originalName}"`);
            console.log("  Academic Entities:");
            console.log(JSON.stringify(doc.metadata.academicEntities, null, 2));
        }
    });

    await mongoose.disconnect();
}

main().catch(console.error);
