const ContentCleaner = require("../ContentCleaner");

class HTMLExtractor {
    /**
     * Extracts text content from an HTML Buffer
     * @param {Buffer} buffer
     * @param {string} [url=""]
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer, url = "") {
        try {
            const htmlString = buffer.toString("utf-8");
            const cleanResult = ContentCleaner.clean(htmlString, url);

            return {
                text: cleanResult.content || "",
                metadata: {
                    title: cleanResult.title || "HTML Document",
                    excerpt: cleanResult.excerpt || ""
                },
                documentType: "html"
            };
        } catch (err) {
            console.error("[HTMLExtractor] Failed to extract text from HTML buffer:", err.message);
            throw new Error(`HTML extraction failed: ${err.message}`);
        }
    }
}

module.exports = HTMLExtractor;
