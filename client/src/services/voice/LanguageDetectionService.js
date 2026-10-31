/**
 * LanguageDetectionService.js
 * Service for local client-side language detection, entity preservation, and system prompt construction.
 * 
 * EduMate Mission 8.4:
 * - Smart multilingual recognition (English, Hindi, Bengali).
 * - Preservation of names, departments, and course codes ("CSS department", "BCA fee structure", "MBA admission").
 * - Mixed Hindi-English (Hinglish) support without awkward translation of technical entities.
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
            case "hi-IN":
                return "hi-IN";
            case "bn":
            case "bn-IN":
                return "bn-IN";
            case "en-US":
                return "en-US";
            case "en":
            case "en-IN":
            default:
                return "en-IN";
        }
    }

    /**
     * Preserves technical terms, course codes, and departmental names in mixed speech.
     * @param {string} text
     * @returns {string}
     */
    preserveTechnicalEntities(text) {
        if (!text) return "";
        let normalized = text;
        const entityMap = [
            [/\bcss\s+dept(?:artment)?\b/gi, "CSS department"],
            [/\bcse\s+dept(?:artment)?\b/gi, "CSE department"],
            [/\bece\s+dept(?:artment)?\b/gi, "ECE department"],
            [/\bhod\b/gi, "HOD"],
            [/\bbca\b/gi, "BCA"],
            [/\bmca\b/gi, "MCA"],
            [/\bmba\b/gi, "MBA"],
            [/\bbtech\b/gi, "B.Tech"],
            [/\bmtech\b/gi, "M.Tech"],
            [/\bphd\b/gi, "Ph.D."],
            [/\bcgpa\b/gi, "CGPA"],
            [/\bsgpa\b/gi, "SGPA"]
        ];

        for (const [regex, replacement] of entityMap) {
            normalized = normalized.replace(regex, replacement);
        }
        return normalized;
    }
}

export default new LanguageDetectionService();
