// Disabled - Switched LLM provider to Google Gemini 2.5 Flash
module.exports = {
    generateCompletion: async () => ({ success: false, failures: ["Groq provider is disabled."] }),
    generateStream: async () => ({ success: false, failures: ["Groq provider is disabled."] }),
    getConfiguredProviders: async () => []
};
