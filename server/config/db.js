const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log("======================================");
        console.log("✅ MongoDB Connected Successfully");
        console.log(`🌐 Host : ${conn.connection.host}`);
        console.log(`📂 Database : ${conn.connection.name}`);
        console.log("======================================");

    } catch (error) {
        console.error("======================================");
        console.error("❌ MongoDB Connection Failed");
        console.error(error);
        console.error("======================================");
        process.exit(1);
    }
};

module.exports = connectDB;