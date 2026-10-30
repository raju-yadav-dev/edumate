const path = require("path");
const fs = require("fs");

class ImageExtractor {
    /**
     * Extracts text from an image buffer using local tesseract.js OCR.
     * Uses offline traineddata stored in server directory.
     * @param {Buffer} buffer
     * @param {string} [fileName="image"]
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer, fileName = "image") {
        if (!buffer || buffer.length === 0) {
            throw new Error("Cannot extract text from empty image buffer.");
        }

        const savedWindow = global.window;
        const savedDocument = global.document;
        delete global.window;
        delete global.document;

        let worker = null;
        try {
            const { createWorker } = require("tesseract.js");
            const serverDir = path.resolve(__dirname, "../../");
            const projectRoot = path.resolve(__dirname, "../../../");
            const trainedDataDir = fs.existsSync(path.join(serverDir, "eng.traineddata")) ? serverDir : (fs.existsSync(path.join(projectRoot, "eng.traineddata")) ? projectRoot : process.cwd());
            const engTrainedData = path.join(trainedDataDir, "eng.traineddata");

            if (!fs.existsSync(engTrainedData)) {
                throw new Error(`OCR language model not found at '${engTrainedData}'. Local Tesseract OCR is unconfigured.`);
            }

            worker = await createWorker("eng", 1, {
                langPath: trainedDataDir,
                gzip: false
            });

            const result = await worker.recognize(buffer);
            const text = (result?.data?.text || "").trim();

            if (!text) {
                const noTextErr = new Error("No readable text found in the image. Please upload an image containing clear, legible text.");
                noTextErr.errorCode = "NO_READABLE_TEXT";
                throw noTextErr;
            }

            return {
                text,
                metadata: {
                    isImage: true,
                    isOcr: true,
                    ocrEngine: "tesseract.js",
                    sourceFile: fileName,
                    confidence: result?.data?.confidence || null
                },
                documentType: "image"
            };
        } catch (err) {
            console.error(`[ImageExtractor] OCR failed for '${fileName}':`, err.message);
            const wrappedErr = new Error(`Image OCR text extraction failed: ${err.message}`);
            wrappedErr.errorCode = err.errorCode || "OCR_EXTRACTION_FAILED";
            throw wrappedErr;
        } finally {
            if (worker) {
                try {
                    await worker.terminate();
                } catch (_) {}
            }
            if (savedWindow !== undefined) global.window = savedWindow;
            if (savedDocument !== undefined) global.document = savedDocument;
        }
    }
}

module.exports = ImageExtractor;
