const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../server/.env") });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const Document = require("../server/models/Document");
    const docs = await Document.find({
        "metadata.academicEntities": {
            $elemMatch: {
                $or: [
                    { degree: /Hospital/i },
                    { programme: /Hospital/i },
                    { department: /Hospital/i },
                    { aliases: /Hospital/i }
                ]
            }
        }
    }).lean();

    console.log(`Found ${docs.length} documents matching "Hospital" in academicEntities:`);
    docs.forEach(doc => {
        console.log(`- Document: "${doc.originalName}"`);
        console.log(JSON.stringify(doc.metadata.academicEntities, null, 2));
    });

    await mongoose.disconnect();
}

main().catch(console.error);
