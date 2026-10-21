const pdfExtractor = require("../../ai/utils/pdfExtractor");

class PDFExtractor {
    /**
     * Extracts text content from a PDF Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const result = await pdfExtractor.extractText(buffer);
            const fullText = (result.pages || []).map((p) => p.text).filter(Boolean).join("\n\n");
            return {
                text: fullText,
                metadata: {
                    pageCount: result.numPages || 1,
                    pages: result.pages || [],
                    requiresOcr: result.requiresOcr,
                    info: result.info || {}
                },
                documentType: "pdf"
            };
        } catch (err) {
            console.error("[PDFExtractor] Failed to parse PDF buffer:", err.message);
            throw new Error(`PDF parsing failed: ${err.message}`);
        }
    }
}

module.exports = PDFExtractor;
