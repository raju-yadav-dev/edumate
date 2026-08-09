const path = require("path");
const mongoose = require("mongoose");

// Load .env from project root
const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env") });

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!");

    const Chunk = require(path.join(projectRoot, "models", "Chunk"));
    const { client, collectionName } = require(path.join(projectRoot, "ai", "config", "qdrant"));

    console.log("Clearing existing Chunk collection...");
    await Chunk.deleteMany({});

    console.log("Scrolling all points from Qdrant...");
    const response = await client.scroll(collectionName, {
        limit: 1000,
        with_payload: true,
        with_vector: true
    });

    console.log(`Retrieved ${response.points.length} points from Qdrant.`);

    const chunkDocs = response.points.map(point => {
        const payload = point.payload || {};
        return {
            document: new mongoose.Types.ObjectId(payload.documentId),
            content: payload.content || "",
            embedding: point.vector || [],
            metadata: {
                pageNumber: payload.pageNumber || 1,
                originalName: payload.originalName || "",
                category: payload.category || "",
                institution: payload.institution || "",
                department: payload.department || ""
            }
        };
    }).filter(doc => doc.document && doc.content);

    console.log(`Inserting ${chunkDocs.length} chunks into MongoDB...`);
    const result = await Chunk.insertMany(chunkDocs);
    console.log(`Successfully synced ${result.length} chunks!`);

    await mongoose.disconnect();
}

run().catch(err => {
    console.error("Sync failed:", err);
    mongoose.disconnect();
});
