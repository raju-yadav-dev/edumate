const path = require("path");
const pdfParse = require("pdf-parse");

if (typeof global.document === "undefined") {
    const mockElement = {
        appendChild: () => {},
        setAttribute: () => {},
        style: {},
        sheet: {
            insertRule: () => {},
            cssRules: []
        },
        getElementsByTagName: () => [{
            appendChild: () => {}
        }],
        getContext: () => ({
            measureText: () => ({ width: 0 }),
            fillRect: () => {},
            drawImage: () => {},
            fillText: () => {},
            getImageData: () => ({
                data: [0, 0, 0, 0]
            })
        }),
        remove: () => {},
        removeChild: () => {}
    };
    global.document = {
        createElement: () => mockElement,
        getElementsByTagName: () => [mockElement],
        documentElement: mockElement,
        head: mockElement,
        body: mockElement
    };
}

if (typeof global.Image === "undefined") {
    global.Image = function() {
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 5);
    };
}

/**
 * Ensures an unpooled, detached Uint8Array copy with byteOffset === 0.
 * Completely eliminates Node.js 64KB Buffer pool memory corruption in pdf.js.
 */
function toPureUint8(buffer) {
    if (!buffer) return new Uint8Array(0);
    if (buffer instanceof Uint8Array && buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
        return buffer;
    }
    return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

/**
 * Convert raw RGBA pixel data to 24-bit uncompressed BMP with safe downscaling.
 * Downscaling bounds memory usage and prevents Node 26 IPC RangeError.
 */
function rgbaToBmp(data, width, height, maxDimension = 1600) {
    let scale = 1;
    if (width > maxDimension || height > maxDimension) {
        scale = maxDimension / Math.max(width, height);
    }
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const rowSize = Math.floor((24 * targetW + 31) / 32) * 4;
    const pixelArraySize = rowSize * targetH;
    const fileSize = 54 + pixelArraySize;
    const buf = Buffer.alloc(fileSize);

    // Bitmap File Header (14 bytes)
    buf.write("BM", 0);
    buf.writeUInt32LE(fileSize, 2);
    buf.writeUInt32LE(54, 10);

    // DIB Header (40 bytes)
    buf.writeUInt32LE(40, 14);
    buf.writeInt32LE(targetW, 18);
    buf.writeInt32LE(targetH, 22); // positive = bottom-to-top
    buf.writeUInt16LE(1, 26);     // color planes
    buf.writeUInt16LE(24, 28);    // 24-bit RGB
    buf.writeUInt32LE(0, 30);     // BI_RGB (uncompressed)
    buf.writeUInt32LE(pixelArraySize, 34);
    buf.writeInt32LE(2835, 38);   // ~72 DPI
    buf.writeInt32LE(2835, 42);

    for (let y = 0; y < targetH; y++) {
        const srcY = Math.min(height - 1, Math.floor((targetH - 1 - y) / scale));
        const rowOffset = 54 + y * rowSize;
        for (let x = 0; x < targetW; x++) {
            const srcX = Math.min(width - 1, Math.floor(x / scale));
            const srcIdx = (srcY * width + srcX) * 4;
            buf[rowOffset + x * 3] = data[srcIdx + 2];     // Blue
            buf[rowOffset + x * 3 + 1] = data[srcIdx + 1]; // Green
            buf[rowOffset + x * 3 + 2] = data[srcIdx];     // Red
        }
    }
    return buf;
}

/**
 * Extracts text page-by-page from a PDF buffer.
 * Automatically runs local OCR when pages contain scanned images without text layer.
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<Object>} - { pages: Array<{pageNumber: number, text: string, hasImage: boolean, needsOcr: boolean, isOcr: boolean}>, numPages: number, requiresOcr: boolean, info: Object }
 */
const extractText = async (pdfBuffer) => {
    if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Cannot extract text from empty or null PDF buffer.");
    }

    const pure = toPureUint8(pdfBuffer);
    const pageTexts = [];

    // PDFJS Operator list codes corresponding to image rendering
    const IMAGE_OPS = new Set([
        63, // beginInlineImage
        82, // paintJpegXObject
        83, // paintImageMaskXObject
        84, // paintImageMaskXObjectGroup
        85, // paintImageXObject
        86, // paintInlineImageXObject
        87, // paintInlineImageXObjectGroup
        88, // paintImageXObjectRepeat
        89, // paintImageMaskXObjectRepeat
        90  // paintSolidColorImageMask
    ]);

    const renderPage = async (pageData) => {
        const textContent = await pageData.getTextContent();
        let lastY;
        let text = "";

        for (const item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) {
                text += item.str;
            } else {
                text += "\n" + item.str;
            }
            lastY = item.transform[5];
        }

        let hasImage = false;
        const imageObjs = [];
        try {
            const operatorList = await pageData.getOperatorList();
            if (operatorList && operatorList.fnArray) {
                for (let i = 0; i < operatorList.fnArray.length; i++) {
                    const fnId = operatorList.fnArray[i];
                    if (IMAGE_OPS.has(fnId)) {
                        hasImage = true;
                        const arg = operatorList.argsArray[i]?.[0];
                        if (arg && typeof arg === "string") {
                            imageObjs.push(arg);
                        }
                    }
                }
            }
        } catch (opError) {
            console.warn(`[PDF Extractor] Page ${pageData.pageNumber} operator list fetch failed: ${opError.message}`);
        }

        let trimmedText = text.trim();
        let isOcr = false;

        // If page has insufficient embedded text but contains image objects, run local Tesseract OCR
        if (trimmedText.length < 50 && hasImage && imageObjs.length > 0) {
            const savedDoc = global.document;
            const savedWin = global.window;
            delete global.document;
            delete global.window;

            try {
                const { createWorker } = require("tesseract.js");
                const serverDir = path.resolve(__dirname, "../../");

                for (const imgName of imageObjs) {
                    try {
                        const img = await new Promise((resolve) => pageData.objs.get(imgName, resolve));
                        if (img && img.data && img.width > 50 && img.height > 50) {
                            const bmp = rgbaToBmp(img.data, img.width, img.height);
                            const worker = await createWorker("eng", 1, {
                                langPath: serverDir,
                                gzip: false
                            });
                            const ocrResult = await worker.recognize(bmp);
                            await worker.terminate();

                            const ocrText = ocrResult?.data?.text?.trim() || "";
                            if (ocrText.length > 0) {
                                trimmedText = trimmedText ? `${trimmedText}\n\n${ocrText}` : ocrText;
                                isOcr = true;
                            }
                        }
                    } catch (singleImgErr) {
                        console.warn(`[PDF Extractor] Local OCR on image ${imgName} failed: ${singleImgErr.message}`);
                    }
                }
            } catch (tessInitErr) {
                console.warn(`[PDF Extractor] Failed to initialize local Tesseract worker: ${tessInitErr.message}`);
            } finally {
                if (savedDoc !== undefined) global.document = savedDoc;
                if (savedWin !== undefined) global.window = savedWin;
            }
        }

        const needsOcr = trimmedText.length < 50;

        pageTexts.push({
            pageNumber: pageData.pageNumber,
            text: trimmedText,
            hasImage,
            needsOcr,
            isOcr
        });

        return text;
    };

    let data;
    try {
        data = await pdfParse(pure, { pagerender: renderPage });
    } catch (parseError) {
        console.error(`[PDF Extractor] pdf-parse failed: ${parseError.message}`);
        throw new Error(`PDF parsing failed: ${parseError.message}`);
    }

    // Handle edge case where pagerender did not capture any pages
    if (pageTexts.length === 0 && data.text) {
        pageTexts.push({
            pageNumber: 1,
            text: data.text.trim(),
            hasImage: false,
            needsOcr: data.text.trim().length < 50,
            isOcr: false
        });
    }

    pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);
    const totalExtractedLength = pageTexts.reduce((sum, page) => sum + page.text.length, 0);

    if (totalExtractedLength === 0) {
        throw new Error("PDF contains no extractable text layer or readable image content.");
    }

    return {
        pages: pageTexts,
        numPages: data.numpages || pageTexts.length,
        requiresOcr: pageTexts.some((p) => p.needsOcr),
        info: data.info || {}
    };
};

module.exports = {
    extractText,
    toPureUint8,
    rgbaToBmp
};
