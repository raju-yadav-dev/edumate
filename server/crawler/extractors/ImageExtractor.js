class ImageExtractor {
    /**
     * Extracts text from an image buffer using tesseract.js OCR.
     * Supports English, Hindi, and Bengali detection.
     */
    static async extract(buffer) {
        try {
            const Tesseract = require("tesseract.js");
            console.log("[ImageExtractor] Performing OCR on image buffer...");
            const { data: { text } } = await Tesseract.recognize(buffer, "eng+hin+ben");
            return {
                text: text ? text.trim() : "No text found in image.",
                metadata: { isImage: true, ocrEngine: "tesseract.js" },
                documentType: "image"
            };
        } catch (err) {
            console.warn("[ImageExtractor] OCR failed or tesseract.js not installed:", err.message);
            return {
                text: "[OCR Text Layer Unavailable. Please run 'npm install tesseract.js' on the server to enable image text extraction.]",
                metadata: { isImage: true, error: err.message },
                documentType: "image"
            };
        }
    }
}

module.exports = ImageExtractor;
