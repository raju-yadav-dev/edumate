class CSVExtractor {
    /**
     * Extracts text content from a CSV Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const rawText = buffer.toString("utf-8");
            
            // Clean up Carriage Returns and trailing/leading space of rows
            const cleanedText = rawText
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .join("\n");

            return {
                text: cleanedText,
                metadata: {
                    rowCount: cleanedText.split("\n").length
                },
                documentType: "csv"
            };
        } catch (err) {
            console.error("[CSVExtractor] Failed to parse CSV buffer:", err.message);
            throw new Error(`CSV parsing failed: ${err.message}`);
        }
    }
}

module.exports = CSVExtractor;
