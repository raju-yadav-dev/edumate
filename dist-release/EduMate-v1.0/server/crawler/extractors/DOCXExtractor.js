const mammoth = require("mammoth");

class DOCXExtractor {
    /**
     * Extracts text content from a Word (.docx) Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return {
                text: result.value || "",
                metadata: {
                    warnings: result.warnings || []
                },
                documentType: "docx"
            };
        } catch (err) {
            console.error("[DOCXExtractor] Failed to parse DOCX buffer:", err.message);
            throw new Error(`DOCX parsing failed: ${err.message}`);
        }
    }
}

module.exports = DOCXExtractor;
