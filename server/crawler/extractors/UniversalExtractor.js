const path = require("path");
const PDFExtractor = require("./PDFExtractor");
const DOCXExtractor = require("./DOCXExtractor");
const PPTExtractor = require("./PPTExtractor");
const ExcelExtractor = require("./ExcelExtractor");
const CSVExtractor = require("./CSVExtractor");
const TXTExtractor = require("./TXTExtractor");
const HTMLExtractor = require("./HTMLExtractor");
const XMLExtractor = require("./XMLExtractor");
const MarkdownExtractor = require("./MarkdownExtractor");
const ZipExtractor = require("./ZipExtractor");
const ImageExtractor = require("./ImageExtractor");

class UniversalExtractor {
    /**
     * Identifies document type and parses buffer content
     * @param {Buffer} buffer - File content stream
     * @param {string} fileName - Filename or target path
     * @returns {Promise<Object>} - Output schema: { text, metadata, documentType }
     */
    static async extract(buffer, fileName = "") {
        if (!buffer || buffer.length === 0) {
            return { text: "", metadata: {}, documentType: "unknown" };
        }

        // 1. Detect file type based on extension first (robust, fast)
        let ext = path.extname(fileName).toLowerCase();

        // 2. Fallback: try using dynamic file-type magic bytes check
        if (!ext) {
            try {
                // file-type might be ESM, import dynamically
                const { fileTypeFromBuffer } = await import("file-type");
                const detected = await fileTypeFromBuffer(buffer);
                if (detected) {
                    ext = `.${detected.ext}`;
                }
            } catch (err) {
                // Ignore import failures, proceed with default extension
            }
        }

        // 3. Match format and route to dedicated extractor
        switch (ext) {
            case ".pdf":
                return await PDFExtractor.extract(buffer);

            case ".zip":
                return await ZipExtractor.extract(buffer);

            case ".png":
            case ".jpg":
            case ".jpeg":
            case ".webp":
            case ".gif":
                return await ImageExtractor.extract(buffer);

            case ".docx":
                return await DOCXExtractor.extract(buffer);

            case ".doc":
            case ".ppt":
            case ".pptx":
                // Use officeparser for word/ppt presentation slides
                return await PPTExtractor.extract(buffer, ext.slice(1));

            case ".xls":
            case ".xlsx":
            case ".ods":
                return await ExcelExtractor.extract(buffer);

            case ".csv":
                return await CSVExtractor.extract(buffer);

            case ".html":
            case ".htm":
                return await HTMLExtractor.extract(buffer, fileName);

            case ".xml":
                return await XMLExtractor.extract(buffer);

            case ".md":
            case ".markdown":
                return await MarkdownExtractor.extract(buffer);

            case ".json":
                try {
                    const raw = buffer.toString("utf-8");
                    const parsed = JSON.parse(raw);
                    return {
                        text: JSON.stringify(parsed, null, 2),
                        metadata: { isJson: true },
                        documentType: "json"
                    };
                } catch {
                    return await TXTExtractor.extract(buffer);
                }

            default:
                // Default fallback to plain text parsing
                return await TXTExtractor.extract(buffer);
        }
    }
}

module.exports = UniversalExtractor;
