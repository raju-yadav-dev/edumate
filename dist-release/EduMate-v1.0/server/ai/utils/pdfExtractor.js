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

const pdfParse = require("pdf-parse");

/**
 * Extracts text page-by-page from a PDF buffer
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Object>} - { pages: Array<{pageNumber: number, text: string}>, numPages: number, requiresOcr: boolean }
 */
const extractText = async (pdfBuffer) => {
    const pageTexts = [];
    
    // PDFJS Operator list codes corresponding to image rendering functions
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

    // Custom pagerender to capture text and page mappings
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
        try {
            const operatorList = await pageData.getOperatorList();
            if (operatorList && operatorList.fnArray) {
                for (const fnId of operatorList.fnArray) {
                    if (IMAGE_OPS.has(fnId)) {
                        hasImage = true;
                        break;
                    }
                }
            }
        } catch (opError) {
            console.warn(`[PDF Extractor] Page ${pageData.pageNumber} operator list fetch failed: ${opError.message}`);
        }

        const trimmedText = text.trim();
        const needsOcr = trimmedText.length < 50 || hasImage;

        pageTexts.push({
            pageNumber: pageData.pageNumber,
            text: trimmedText,
            hasImage,
            needsOcr
        });

        return text;
    };

    const options = {
        pagerender: renderPage
    };

    try {
        const data = await pdfParse(pdfBuffer, options);

        // Handle fallback if pagerender did not capture any pages (e.g. edge cases)
        if (pageTexts.length === 0 && data.text) {
            pageTexts.push({
                pageNumber: 1,
                text: data.text.trim(),
                hasImage: false,
                needsOcr: true
            });
        }

        // Sort pageTexts in ascending order since pages can resolve out-of-order in the pagerender promise
        pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);

        // Calculate total extracted character length to determine if OCR is needed
        const totalExtractedLength = pageTexts.reduce((sum, page) => sum + page.text.length, 0);
        const requiresOcr = totalExtractedLength < 50 || pageTexts.some(p => p.needsOcr);

        return {
            pages: pageTexts,
            numPages: data.numpages || pageTexts.length,
            requiresOcr,
            info: data.info || {}
        };
    } catch (parseError) {
        console.warn(`[PDF Extractor] pdf-parse failed, falling back to raw text extraction: ${parseError.message}`);
        
        // Clean ASCII/UTF-8 extraction fallback
        const rawStr = pdfBuffer.toString("binary");
        const printableMatches = rawStr.match(/[\x20-\x7E]{4,}/g) || [];
        const cleanWords = printableMatches
            .map(s => s.trim())
            .filter(s => s.length > 3 && !s.startsWith("/") && !s.includes("ReportLab") && !s.includes("obj") && !s.includes("endobj"));
            
        const fallbackText = cleanWords.slice(0, 100).join(" ") || "Uploaded document text layer could not be parsed.";
        
        pageTexts.push({
            pageNumber: 1,
            text: fallbackText,
            hasImage: false,
            needsOcr: true
        });
        
        return {
            pages: pageTexts,
            numPages: 1,
            requiresOcr: true,
            info: { Title: "Fallback Extracted Document" }
        };
    }
};

module.exports = {
    extractText
};
