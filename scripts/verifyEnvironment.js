const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const envPath = path.resolve(__dirname, "../.env");

const REQUIRED_VARS = [
    "PORT",
    "MONGODB_URI",
    "JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "QDRANT_URL",
    "QDRANT_COLLECTION"
];

/**
 * Verifies that the .env file exists and contains all required variables
 * @returns {boolean} - True if env is fully valid, false otherwise
 */
const verifyEnvironment = () => {
    console.log(logger.cyan("Verifying environment variables..."));

    if (!fs.existsSync(envPath)) {
        console.error(logger.red("❌ Error: .env file is missing in the repository root."));
        console.error(logger.cyan("Please create a .env file and copy the environment configuration fields."));
        return false;
    }

    const missing = [];
    for (const variable of REQUIRED_VARS) {
        if (!process.env[variable]) {
            missing.push(variable);
        }
    }

    if (missing.length > 0) {
        console.error(logger.red(`❌ Error: Missing required environment variable(s) in .env: ${missing.join(", ")}`));
        return false;
    }

    console.log(logger.green("✓ All required environment variables verified."));
    return true;
};

module.exports = {
    verifyEnvironment
};
