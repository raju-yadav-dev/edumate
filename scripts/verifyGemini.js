const gemini = require("../server/ai/config/gemini");
const logger = require("./logger");

/**
 * Validates the Gemini API key against Google's endpoints by generating a test embedding
 * @returns {Promise<boolean>}
 */
const verifyGemini = async () => {
    console.log(logger.cyan("Verifying Google Gemini API connection..."));
    
    try {
        const testEmbedding = await gemini.generateEmbedding("verification ping");
        
        if (Array.isArray(testEmbedding) && testEmbedding.length > 0) {
            console.log(logger.green("✓ Google Gemini connection and key validated successfully."));
            return true;
        }
        
        throw new Error("Embedding payload resolved with an invalid structure.");
    } catch (err) {
        console.error(logger.red(`❌ Error: Google Gemini credentials check failed: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifyGemini
};
