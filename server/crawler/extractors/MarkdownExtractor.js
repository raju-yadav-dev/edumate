class MarkdownExtractor {
    /**
     * Extracts readable text content from a Markdown Buffer while preserving headings and lists
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        if (!buffer || buffer.length === 0) {
            throw new Error("Cannot extract text from empty Markdown buffer.");
        }

        try {
            const rawText = buffer.toString("utf-8");

            // Clean Markdown syntax while explicitly preserving headings (# Heading) and lists (- item)
            const cleanedText = rawText
                .replace(/\r\n/g, "\n")
                .replace(/```[\s\S]*?```/g, "")       // Remove code blocks
                .replace(/`([^`]+)`/g, "$1")          // Inline code to text
                .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // Images to alt text
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Links to text
                .replace(/<[^>]+>/g, "")              // Raw HTML tags
                .replace(/(\*\*|__)(.*?)\1/g, "$2")   // Bold to text
                .replace(/(\*|_)(.*?)\1/g, "$2")     // Italics to text
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            const headings = (cleanedText.match(/^#{1,6}\s+.+$/gm) || []).map((h) => h.replace(/^#{1,6}\s+/, "").trim());

            return {
                text: cleanedText,
                metadata: {
                    headings,
                    headingCount: headings.length
                },
                documentType: "markdown"
            };
        } catch (err) {
            console.error("[MarkdownExtractor] Failed to read markdown buffer:", err.message);
            throw new Error(`Markdown extraction failed: ${err.message}`);
        }
    }
}

module.exports = MarkdownExtractor;
