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

/**
 * Detect file type from magic bytes header
 */
function detectMagicType(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // PDF (%PDF-)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return ".pdf";
    }

    // PNG (\x89PNG)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return ".png";
    }

    // JPEG (\xFF\xD8\xFF)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return ".jpg";
    }

    // BMP (BM)
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
        return ".bmp";
    }

    // TIFF (II*\0 or MM\0*)
    if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
        (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
        return ".tiff";
    }

    // WEBP (RIFF....WEBP)
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return ".webp";
    }

    // OLE2 Compound Binary (Legacy Word/PowerPoint/Excel 97-2003)
    if (buffer.length >= 8 &&
        buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
        buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1) {
        return ".doc_ole2";
    }

    // ZIP / OpenXML (PK\x03\x04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
        return ".zip_openxml";
    }

    return null;
}

/**
 * Format JSON data into structured readable key-value text preserving hierarchy
 */
function formatJsonToText(data, prefix = "") {
    if (data === null || data === undefined) return `${prefix}: null\n`;
    if (typeof data !== "object") return `${prefix}: ${data}\n`;

    let text = "";
    if (Array.isArray(data)) {
        data.forEach((item, idx) => {
            const itemPrefix = prefix ? `${prefix}[${idx + 1}]` : `Item ${idx + 1}`;
            if (typeof item === "object" && item !== null) {
                text += `${itemPrefix}:\n${formatJsonToText(item, "  " + itemPrefix)}`;
            } else {
                text += `${itemPrefix}: ${item}\n`;
            }
        });
    } else {
        for (const [key, val] of Object.entries(data)) {
            const currentKey = prefix ? `${prefix}.${key}` : key;
            if (typeof val === "object" && val !== null) {
                text += `${currentKey}:\n${formatJsonToText(val, "  " + currentKey)}`;
            } else {
                text += `${currentKey}: ${val}\n`;
            }
        }
    }
    return text;
}

class UniversalExtractor {
    /**
     * Identifies document type and parses buffer content with explicit format handlers
     * @param {Buffer} buffer - File content stream
     * @param {string} fileName - Filename or target path
     * @returns {Promise<Object>} - Output schema: { text, metadata, documentType }
     */
    static async extract(buffer, fileName = "") {
        if (!buffer || buffer.length === 0) {
            throw new Error("Cannot extract content from empty or null buffer.");
        }

        let ext = path.extname(fileName || "").toLowerCase();
        const magicType = detectMagicType(buffer);

        // Disallow legacy Word 97-2003 OLE2 binary format with clear actionable guidance
        if (ext === ".doc" || magicType === ".doc_ole2") {
            const err = new Error("Legacy Word 97-2003 (.doc) binary format requires conversion to modern Word (.docx) or PDF before indexing.");
            err.errorCode = "LEGACY_DOC_NOT_SUPPORTED";
            throw err;
        }

        // If no extension or ambiguous, resolve from magic bytes
        if (!ext && magicType) {
            if (magicType === ".zip_openxml") {
                ext = ".docx";
            } else {
                ext = magicType;
            }
        }

        switch (ext) {
            case ".pdf":
                return await PDFExtractor.extract(buffer);

            case ".docx":
                return await DOCXExtractor.extract(buffer);

            case ".pptx":
            case ".ppt":
                return await PPTExtractor.extract(buffer, ext.slice(1));

            case ".png":
            case ".jpg":
            case ".jpeg":
            case ".webp":
            case ".bmp":
            case ".tiff":
            case ".tif":
            case ".gif":
                return await ImageExtractor.extract(buffer, path.basename(fileName || "image"));

            case ".xlsx":
            case ".xls":
            case ".ods":
                return await ExcelExtractor.extract(buffer);

            case ".csv":
                return await CSVExtractor.extract(buffer);

            case ".html":
            case ".htm":
                return await HTMLExtractor.extract(buffer, fileName);

            case ".md":
            case ".markdown":
                return await MarkdownExtractor.extract(buffer);

            case ".xml":
                return await XMLExtractor.extract(buffer);

            case ".zip":
                return await ZipExtractor.extract(buffer);

            case ".json":
                try {
                    const raw = buffer.toString("utf-8");
                    const parsed = JSON.parse(raw);
                    const formatted = formatJsonToText(parsed);
                    return {
                        text: formatted.trim() || JSON.stringify(parsed, null, 2),
                        metadata: { isJson: true, keyCount: typeof parsed === "object" ? Object.keys(parsed).length : 0 },
                        documentType: "json"
                    };
                } catch {
                    return await TXTExtractor.extract(buffer);
                }

            default:
                return await TXTExtractor.extract(buffer);
        }
    }
}

module.exports = UniversalExtractor;
