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
            console.warn("[ImageExtractor] OCR failed, attempting Gemini fallback:", err.message);
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) throw err;
                const model = process.env.GEMINI_COMPLETION_MODEL || "gemini-3.5-flash";
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const fetch = (() => {
                    try {
                        return require("node-fetch");
                    } catch {
                        return global.fetch;
                    }
                })();
                const requestBody = {
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: "image/png", data: buffer.toString("base64") } },
                            { text: "Extract and return only the text from this image." }
                        ]
                    }]
                };
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });
                const payload = await res.json();
                const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
                return {
                    text: text.trim(),
                    metadata: { isImage: true, ocrEngine: "gemini" },
                    documentType: "image"
                };
            } catch (geminiErr) {
                console.error("Gemini image fallback failed:", geminiErr.message);
                return {
                    text: "[OCR Text Layer Unavailable. Please run 'npm install tesseract.js' on the server to enable image text extraction.]",
                    metadata: { isImage: true, error: err.message },
                    documentType: "image"
                };
            }
        }
    }
}

module.exports = ImageExtractor;
