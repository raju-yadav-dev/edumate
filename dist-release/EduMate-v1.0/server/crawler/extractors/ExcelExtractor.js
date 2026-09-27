const xlsx = require("xlsx");

class ExcelExtractor {
    /**
     * Extracts text content from an Excel (.xls/.xlsx/.ods) Buffer
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        try {
            const workbook = xlsx.read(buffer, { type: "buffer" });
            let allText = "";

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                // Convert sheets to CSV strings for structured text output
                const sheetCsv = xlsx.utils.sheet_to_csv(sheet);
                if (sheetCsv.trim()) {
                    allText += `--- Sheet: ${sheetName} ---\n${sheetCsv}\n\n`;
                }
            });

            return {
                text: allText.trim(),
                metadata: {
                    sheetNames: workbook.SheetNames
                },
                documentType: "xlsx"
            };
        } catch (err) {
            console.error("[ExcelExtractor] Failed to parse excel buffer:", err.message);
            throw new Error(`Excel parsing failed: ${err.message}`);
        }
    }
}

module.exports = ExcelExtractor;
