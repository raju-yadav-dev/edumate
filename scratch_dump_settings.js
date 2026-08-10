const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
    console.log("Connecting to:", process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected!");
    const Setting = require("./server/models/Setting");
    const settings = await Setting.find({}).lean();
    console.log("All Settings:");
    console.log(JSON.stringify(settings, null, 2));
    await mongoose.disconnect();
}
run().catch(console.error);
