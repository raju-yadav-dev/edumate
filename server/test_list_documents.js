const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const documentService = require("./services/documentService");

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected successfully.");

        // Simulate listing parameters from the Admin panel
        const mockQuery = {
            search: "",
            category: "fees",
            page: 1,
            limit: 20,
            ignoreInstitution: "true",
            department: "",
            institution: "",
            version: "",
            processingStatus: ""
        };

        const result = await documentService.listDocuments({
            query: mockQuery,
            user: { _id: new mongoose.Types.ObjectId(), role: "admin" }
        });

        console.log(`\nReturned ${result.documents.length} documents:`);
        result.documents.forEach(d => {
            console.log(`- ID: ${d._id} | Name: "${d.originalName}" | status: "${d.status}" | embeddingStatus: "${d.embeddingStatus}"`);
        });

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
