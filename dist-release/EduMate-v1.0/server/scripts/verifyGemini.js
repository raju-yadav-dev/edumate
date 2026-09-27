const colors = require("./colors");
const fetch = (() => {
    try {
        return require("node-fetch");
    } catch {
        return global.fetch;
    }
})();

/**
 * Validates the configured Gemini connection by generating a test completion ping
 * @returns {Promise<boolean>}
 */
const verifyGemini = async () => {
    console.log(colors.cyan("Verifying Gemini API connection and keys..."));
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error(colors.red("❌ Error: GEMINI_API_KEY is not set."));
        return false;
    }
    
    const configuredModel = process.env.GEMINI_COMPLETION_MODEL;
    const model = (!configuredModel || configuredModel === "gemini-2.5-flash") ? "gemini-3.5-flash" : configuredModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "ping" }] }]
            })
        });
        
        const payload = await response.json();
        
        if (response.ok) {
            console.log(colors.green("✓ Gemini API validated successfully."));
            return true;
        }
        
        console.error(colors.red(`❌ Error: Gemini connection check failed with status ${response.status}.`));
        console.error(colors.red(`Details: ${payload.error?.message || "Unknown error"}`));
        return false;
    } catch (err) {
        console.error(colors.red(`❌ Error: Gemini connection check encountered an unexpected error: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifyGemini
};
