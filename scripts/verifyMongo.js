const mongoose = require("mongoose");
const logger = require("./logger");
const dns = require("dns");

let dnsConfigured = false;
const configureDNSFallback = () => {
    if (dnsConfigured) return;
    try {
        dns.setServers(["1.1.1.1", "8.8.8.8"]);
        dnsConfigured = true;
        console.log(logger.cyan("Applied fallback DNS servers (1.1.1.1, 8.8.8.8) to resolve MongoDB SRV records."));
    } catch (e) {
        // Ignore DNS custom configuration error
    }
};

/**
 * Connects and checks health of the MongoDB instance
 * @returns {Promise<boolean>}
 */
const verifyMongo = async () => {
    console.log(logger.cyan("Verifying MongoDB connection..."));
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error(logger.red("❌ Error: MONGODB_URI is not configured in your environment."));
        return false;
    }

    if (uri.startsWith("mongodb+srv://")) {
        configureDNSFallback();
    }

    const options = {
        serverSelectionTimeoutMS: 4000 // Timeout fast if unreachable
    };

    let retries = 3;
    let attemptedFallback = false;
    while (retries > 0) {
        try {
            // Establish a temporary connection to ping the cluster
            await mongoose.connect(uri, options);
            await mongoose.disconnect();
            console.log(logger.green("✓ MongoDB Atlas connection verified successfully."));
            return true;
        } catch (err) {
            retries--;
            console.log(logger.yellow(`⚠️ MongoDB Atlas warning: Connection attempt failed. Retries left: ${retries}. Details: ${err.message}`));
            
            const isDnsOrTimeoutError = err.message.includes("ENOTFOUND") || 
                                       err.message.includes("EREFUSED") || 
                                       err.message.includes("ECONNREFUSED") ||
                                       err.message.includes("querySrv") ||
                                       err.message.includes("Timeout") ||
                                       err.name === "MongooseServerSelectionError";
            if (isDnsOrTimeoutError && !attemptedFallback) {
                console.log(logger.cyan("🔄 Potential DNS/Network resolution issue detected. Applying DNS fallback..."));
                configureDNSFallback();
                attemptedFallback = true;
            }

            if (retries > 0) {
                // Wait 2 seconds before checking connection again
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    console.error(logger.red("❌ Error: MongoDB connection could not be established. Please check your credentials and internet status."));
    return false;
};

module.exports = {
    verifyMongo
};
