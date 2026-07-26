const fs = require("fs");
const path = require("path");
const colors = require("./colors");

// Ensure environment variables are loaded
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    require("dotenv").config();
}

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
    console.log(colors.cyan("Verifying environment variables..."));

    if (!fs.existsSync(envPath)) {
        console.error(colors.red("❌ Error: .env file is missing in the server root."));
        console.error(colors.cyan("Please create a .env file and copy the environment configuration fields."));
        return false;
    }

    const missing = [];
    for (const variable of REQUIRED_VARS) {
        if (!process.env[variable]) {
            missing.push(variable);
        }
    }

    if (missing.length > 0) {
        console.error(colors.red(`❌ Error: Missing required environment variable(s) in .env: ${missing.join(", ")}`));
        return false;
    }

    console.log(colors.green("✓ All required environment variables verified."));
    return true;
};

module.exports = {
    verifyEnvironment
};
