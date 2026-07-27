const gemini = require("../server/ai/config/gemini");
const ollama = require("../server/ai/config/ollama");
const logger = require("./logger");

/**
 * Validates the configured AI connection (Ollama or Gemini) by generating a test embedding
 * @returns {Promise<boolean>}
 */
const verifyGemini = async () => {
    const isOllama = process.env.LLM_PROVIDER === "ollama";
    
    if (isOllama) {
        console.log(logger.cyan("Verifying Ollama connection and model..."));
        try {
            await ollama.verifyConnection();
            const testEmbedding = await ollama.generateEmbedding("verification ping");
            if (Array.isArray(testEmbedding) && testEmbedding.length > 0) {
                console.log(logger.green("✓ Ollama connection validated successfully."));
                return true;
            }
            throw new Error("Ollama Embedding payload resolved with an invalid structure.");
        } catch (err) {
            console.error(logger.red(`❌ Error: Ollama connection check failed: ${err.message}`));
            console.log(logger.yellow(`💡 Suggestion: Ensure Ollama is running and the model '${process.env.OLLAMA_MODEL || "llama3.2:3b"}' is pulled.`));
            console.log(logger.cyan(`   Run: ollama pull ${process.env.OLLAMA_MODEL || "llama3.2:3b"}`));
            return false;
        }
    }

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
