const mongoose = require("mongoose");
const colors = require("./colors");

// Set fallback DNS servers to resolve MongoDB SRV records on Windows networks/ISPs
try {
    const dns = require("dns");
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
} catch (e) {
    // Ignore DNS custom configuration error
}

/**
 * Connects and checks health of the MongoDB instance
 * @returns {Promise<boolean>}
 */
const verifyMongo = async () => {
    console.log(colors.cyan("Verifying MongoDB connection..."));
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error(colors.red("❌ Error: MONGODB_URI is not configured in your environment."));
        return false;
    }

    const options = {
        serverSelectionTimeoutMS: 4000 // Timeout fast if unreachable
    };

    let retries = 3;
    while (retries > 0) {
        try {
            // Establish a temporary connection to ping the cluster
            await mongoose.connect(uri, options);
            await mongoose.disconnect();
            console.log(colors.green("✓ MongoDB Atlas connection verified successfully."));
            return true;
        } catch (err) {
            retries--;
            console.log(colors.yellow(`⚠️ MongoDB Atlas warning: Connection attempt failed. Retries left: ${retries}. Details: ${err.message}`));
            if (retries > 0) {
                // Wait 2 seconds before checking connection again
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    console.error(colors.red("❌ Error: MongoDB connection could not be established. Please check your credentials and internet status."));
    return false;
};

module.exports = {
    verifyMongo
};
