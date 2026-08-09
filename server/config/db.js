const mongoose = require("mongoose");
const dns = require("dns");

let dnsConfigured = false;
const configureDNSFallback = () => {
    if (dnsConfigured) return;
    try {
        dns.setServers(["1.1.1.1", "8.8.8.8"]);
        dnsConfigured = true;
        console.log("Applied fallback DNS servers (1.1.1.1, 8.8.8.8) to resolve MongoDB SRV records.");
    } catch (e) {
        // Ignore
    }
};

const connectDB = async () => {
    const options = {
        serverSelectionTimeoutMS: 5000 // Timeout fast for diagnostic retries
    };

    let retries = 3;
    let attemptedFallback = false;

    while (retries > 0) {
        try {
            const conn = await mongoose.connect(process.env.MONGODB_URI, options);

            console.log(`
+==========================================================_+
|                   ✓ MongoDB Connected                    |
|                                                          |
| Host        : ${conn.connection.host}
| Database    : ${conn.connection.name}
| Version     : ${mongoose.version}
| Status      : ONLINE
+==========================================================_+
`);

            return conn;

        } catch (error) {
            retries--;
            console.log(`⚠️ MongoDB connection attempt failed. Retries left: ${retries}. Details: ${error.message}`);

            const isDnsOrTimeoutError = error.message.includes("ENOTFOUND") || 
                                       error.message.includes("EREFUSED") || 
                                       error.message.includes("Timeout") ||
                                       error.name === "MongooseServerSelectionError";
            if (isDnsOrTimeoutError && !attemptedFallback) {
                console.log("🔄 Potential DNS/Network resolution issue detected. Applying DNS fallback...");
                configureDNSFallback();
                attemptedFallback = true;
            }

            if (retries === 0) {
                console.log(`
+==========================================================_+
|                ✗ MongoDB Connection Failed               |
+==========================================================_+

${error.message}

`);

                process.exit(1);
            }

            // Wait 2 seconds before retrying
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
};

module.exports = connectDB;