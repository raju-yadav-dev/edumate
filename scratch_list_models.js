const dotenv = require("dotenv");
const path = require("path");
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "server", ".env") });

const listModels = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY is not defined in env files.");
        return;
    }
    
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "x-goog-api-key": apiKey
            }
        });
        
        const data = await response.json();
        if (!response.ok) {
            console.error("API error:", data);
            return;
        }
        
        console.log("=== AVAILABLE GEMINI MODELS ===");
        if (data.models && Array.isArray(data.models)) {
            data.models.forEach(m => {
                const shortName = m.name.replace("models/", "");
                console.log(`Model: ${shortName}`);
                console.log(`Supported Methods: ${m.supportedGenerationMethods.join(", ")}`);
                console.log("------------------------------");
            });
        } else {
            console.log("No models returned in payload:", data);
        }
    } catch (err) {
        console.error("Request failed:", err);
    }
};

listModels();
