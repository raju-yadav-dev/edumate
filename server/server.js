const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log("======================================");
            console.log("🚀 EduMate Server Started Successfully");
            console.log(`🌐 Running on Port : ${PORT}`);
            console.log("======================================");
        });

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();
