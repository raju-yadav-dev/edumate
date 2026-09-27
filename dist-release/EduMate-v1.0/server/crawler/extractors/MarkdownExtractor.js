class MarkdownExtractor {
    /**
     * Extracts text content from a Markdown Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const rawText = buffer.toString("utf-8");

            // Strip Markdown formatting syntax to keep plain text sentences clean
            const cleanedText = rawText
                .replace(/#+\s+/g, "")                // Remove headers syntax (# Header)
                .replace(/`{3,}[\s\S]*?`{3,}/g, "")   // Remove multi-line code blocks
                .replace(/`([^`]+)`/g, "$1")          // Remove inline backticks
                .replace(/\[(.*?)\]\((.*?)\)/g, "$1") // Remove markdown link syntax keeping link name
                .replace(/(\*\*|__)(.*?)\1/g, "$2")   // Remove bold formatting
                .replace(/(\*|_)(.*?)\1/g, "$2")     // Remove italic formatting
                .replace(/>\s+/g, "")                 // Remove blockquotes
                .replace(/^[-\*+]\s+/gm, "")          // Remove bullet points
                .replace(/^\d+\.\s+/gm, "")           // Remove ordered numbers
                .trim();

            return {
                text: cleanedText,
                metadata: {},
                documentType: "markdown"
            };
        } catch (err) {
            console.error("[MarkdownExtractor] Failed to read markdown buffer:", err.message);
            throw new Error(`Markdown extraction failed: ${err.message}`);
        }
    }
}

module.exports = MarkdownExtractor;
