const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const Document = require("../server/models/Document");
    const doc = await Document.findOne({ originalName: /Hospital Management/i }).lean();

    if (doc) {
        console.log(`Document: "${doc.originalName}"`);
        console.log("Academic Entities:");
        console.log(JSON.stringify(doc.metadata?.academicEntities || [], null, 2));
    } else {
        console.log("No BBA Hospital Management document found.");
    }

    await mongoose.disconnect();
}

main().catch(console.error);
