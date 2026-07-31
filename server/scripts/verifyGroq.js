const groqProviderManager = require("../services/groqProviderManager");
const colors = require("./colors");

/**
 * Validates the configured Groq connection by generating a test completion ping
 * @returns {Promise<boolean>}
 */
const verifyGroq = async () => {
    console.log(colors.cyan("Verifying Groq API connection and keys..."));
    try {
        const result = await groqProviderManager.generateCompletion({
            messages: [{ role: "user", content: "ping" }],
            timeoutMs: 10000
        });

        if (result.success) {
            console.log(colors.green(`✓ Groq API validated successfully (Active provider: ${result.provider}).`));
            return true;
        }

        console.error(colors.red("❌ Error: Groq credentials check failed. All configured keys failed."));
        if (result.failures && result.failures.length > 0) {
            console.error(colors.yellow("Failures encountered:"));
            result.failures.forEach(f => {
                console.error(colors.yellow(`  - Provider ${f.provider} (Attempt ${f.attempt}): ${f.message} [Status: ${f.statusCode}]`));
            });
        }
        return false;
    } catch (err) {
        console.error(colors.red(`❌ Error: Groq connection check encountered an unexpected error: ${err.message}`));
        return false;
    }
};

module.exports = {
    verifyGroq
};
