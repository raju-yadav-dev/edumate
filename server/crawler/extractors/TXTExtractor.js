class TXTExtractor {
    /**
     * Extracts text content from a plain TXT Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const text = buffer.toString("utf-8");
            return {
                text: text || "",
                metadata: {
                    characterCount: text.length
                },
                documentType: "txt"
            };
        } catch (err) {
            console.error("[TXTExtractor] Failed to read TXT buffer:", err.message);
            throw new Error(`TXT extraction failed: ${err.message}`);
        }
    }
}

module.exports = TXTExtractor;
