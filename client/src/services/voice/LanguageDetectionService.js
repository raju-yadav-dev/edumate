/**
 * LanguageDetectionService.js
 * Service for local client-side language detection and system prompt construction.
 */

class LanguageDetectionService {
    /**
     * Detects the language of a given text.
     * Checks for script character ranges.
     * @param {string} text - The input text to analyze.
     * @returns {string} - 'hi' (Hindi), 'bn' (Bengali), or 'en' (English).
     */
    detect(text) {
        if (!text) return "en";

        const textClean = text.trim();

        // Devanagari Unicode Block: U+0900 - U+097F (Hindi)
        const devanagariRegex = /[\u0900-\u097F]/;
        if (devanagariRegex.test(textClean)) {
            return "hi";
        }

        // Bengali Unicode Block: U+0980 - U+09FF (Bengali)
        const bengaliRegex = /[\u0980-\u09FF]/;
        if (bengaliRegex.test(textClean)) {
            return "bn";
        }

        // Default fallback to English
        return "en";
    }

    /**
     * Returns the human-readable language name.
     * @param {string} langKey - 'en', 'hi', or 'bn'.
     * @returns {string}
     */
    getLanguageName(langKey) {
        switch (langKey) {
            case "hi":
                return "Hindi";
            case "bn":
                return "Bengali";
            case "en":
            default:
                return "English";
        }
    }

    /**
     * Returns the BCP 47 language code for Speech Recognition.
     * @param {string} langKey - 'en', 'hi', or 'bn'.
     * @returns {string}
     */
    getSpeechRecognitionLang(langKey) {
        switch (langKey) {
            case "hi":
                return "hi-IN";
            case "bn":
                return "bn-IN";
            case "en":
            default:
                return "en-US";
        }
    }

    /**
     * Prepend prompt instructions for Groq LLM based on the target language.
     * This instructs the assistant to respond strictly in the requested language
     * using the RAG context.
     * @param {string} langKey - 'en', 'hi', or 'bn'.
     * @returns {string}
     */
    getSystemPrompt(langKey) {
        switch (langKey) {
            case "hi":
                return "[System: You are a warm, human-like university receptionist named EduMate. Answer ONLY in Hindi using Devanagari script. Keep responses brief (1-3 short sentences maximum), natural, and conversational. Do not use lists, tables, markdown, or bullet points. Speak directly and naturally. Smoothly transition contexts when asked new questions. End with a natural follow-up question in Hindi. Use the retrieved RAG context to formulate the answer. Do not translate this instruction block.]";
            case "bn":
                return "[System: You are a warm, human-like university receptionist named EduMate. Answer ONLY in Bengali script. Keep responses brief (1-3 short sentences maximum), natural, and conversational. Do not use lists, tables, markdown, or bullet points. Speak directly and naturally. Smoothly transition contexts when asked new questions. End with a natural follow-up question in Bengali. Use the retrieved RAG context to formulate the answer. Do not translate this instruction block.]";
            case "en":
            default:
                return "[System: You are a warm, human-like university receptionist named EduMate. Answer in English. Keep responses brief (1-3 short sentences maximum), natural, and conversational. Do not use lists, tables, markdown, or bullet points. Speak directly and naturally. Smoothly transition contexts when asked new questions. End with a natural follow-up question in English. Use the retrieved RAG context to formulate the answer. Do not translate this instruction block.]";
        }
    }
}

export default new LanguageDetectionService();
