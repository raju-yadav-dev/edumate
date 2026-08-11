const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const envPath = path.resolve(__dirname, "../.env");

// Ensure environment variables are loaded
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
}

// Auto-detect LLM provider if not set
if (!process.env.LLM_PROVIDER) {
    process.env.LLM_PROVIDER = "groq";
    console.log(logger.cyan("💡 LLM_PROVIDER not set. Automatically defaulted to 'groq'."));
}

const REQUIRED_VARS = [
    "PORT",
    "MONGODB_URI",
    "JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "QDRANT_URL",
    "QDRANT_COLLECTION"
];

if (process.env.LLM_PROVIDER === "gemini") {
    REQUIRED_VARS.push("GEMINI_API_KEY");
} else if (process.env.LLM_PROVIDER === "groq") {
    REQUIRED_VARS.push("GROQ_API_KEY");
}

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
