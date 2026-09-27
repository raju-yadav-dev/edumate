const cheerio = require("cheerio");

class XMLExtractor {
    /**
     * Extracts text content from an XML Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const xmlString = buffer.toString("utf-8");
            
            // Parse XML structure and fetch text nodes using cheerio xmlMode
            const $ = cheerio.load(xmlString, { xmlMode: true });
            const plainText = $.text()
                .replace(/\s+/g, " ")
                .trim();

            return {
                text: plainText,
                metadata: {},
                documentType: "xml"
            };
        } catch (err) {
            console.error("[XMLExtractor] Failed to parse XML buffer:", err.message);
            throw new Error(`XML parsing failed: ${err.message}`);
        }
    }
}

module.exports = XMLExtractor;
