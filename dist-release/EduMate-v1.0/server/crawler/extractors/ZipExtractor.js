const path = require("path");
const Zip = require("adm-zip");

class ZipExtractor {
    static async extract(buffer) {
        try {
            const zip = new Zip(buffer);
            let combinedText = "";
            const zipEntries = zip.getEntries();
            const UniversalExtractor = require("./UniversalExtractor");

            for (const entry of zipEntries) {
                if (!entry.isDirectory) {
                    const entryBuffer = entry.getData();
                    const entryName = entry.entryName;
                    const ext = path.extname(entryName).toLowerCase();
                    
                    const supported = [
                        ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
                        ".csv", ".txt", ".md", ".markdown", ".xml", ".json", ".html", ".htm"
                    ];
                    if (supported.includes(ext)) {
                        try {
                            const result = await UniversalExtractor.extract(entryBuffer, entryName);
                            if (result && result.text) {
                                combinedText += `\n\n--- File: ${entryName} ---\n${result.text}`;
                            }
                        } catch (err) {
                            console.warn(`[ZipExtractor] Failed to extract ${entryName}: ${err.message}`);
                        }
                    }
                }
            }

            return {
                text: combinedText.trim() || "Empty zip archive content.",
                metadata: { isZip: true, fileCount: zipEntries.length },
                documentType: "zip"
            };
        } catch (e) {
            console.error("[ZipExtractor] Error extracting zip archive:", e);
            throw e;
        }
    }
}

module.exports = ZipExtractor;
