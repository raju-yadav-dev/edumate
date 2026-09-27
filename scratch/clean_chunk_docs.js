require("dotenv").config();
const mongoose = require("mongoose");
const Document = require("../server/models/Document");

async function clean() {
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await Document.deleteMany({ storagePath: /^chunks\// });
    console.log("Deleted stray chunk document entries:", res.deletedCount);
    await mongoose.disconnect();
}

clean();
