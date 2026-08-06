const pdfParse = require("pdf-parse");

class PDFExtractor {
    /**
     * Extracts text content from a PDF Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const data = await pdfParse(buffer);
            return {
                text: data.text || "",
                metadata: {
                    pageCount: data.numpages || 1,
                    info: data.info || {}
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
