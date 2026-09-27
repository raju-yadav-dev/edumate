const officeparser = require("officeparser");

class PPTExtractor {
    /**
     * Extracts text content from a PowerPoint (.ppt/.pptx) or doc file Buffer
     * @param {Buffer} buffer
     * @param {string} fileExt - Optional extension to distinguish type
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer, fileExt = "pptx") {
        try {
            const parsedText = await officeparser.parseOfficeAsync(buffer);
            return {
                text: parsedText || "",
                metadata: {},
                documentType: fileExt
            };
        } catch (err) {
            console.error(`[PPTExtractor] Failed to parse ${fileExt} buffer:`, err.message);
            throw new Error(`${fileExt.toUpperCase()} parsing failed: ${err.message}`);
        }
    }
}

module.exports = PPTExtractor;
