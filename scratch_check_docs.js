const path = require("path");
const mongoose = require("mongoose");

// Load .env from root
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Document = require("./server/models/Document");
    const docs = await Document.find({ status: "active", "metadata.uploadedFrom": "api" }).lean();
    
    console.log(`Found ${docs.length} Admin documents:`);
    docs.forEach((doc, idx) => {
        console.log(`${idx + 1}. [${doc._id}] Name: "${doc.originalName}" | Category: "${doc.category}" | Institution: "${doc.institution}"`);
    });
    
    await mongoose.disconnect();
}

run().catch(console.error);
