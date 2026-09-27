const pdfParse = require("pdf-parse");

/**
 * Extracts text page-by-page from a PDF buffer
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Object>} - { pages: Array<{pageNumber: number, text: string}>, numPages: number, requiresOcr: boolean }
 */
const extractText = async (pdfBuffer) => {
    const pageTexts = [];

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

        pageTexts.push({
            pageNumber: pageData.pageNumber,
            text: text.trim()
        });

        return text;
    };

    const options = {
        pagerender: renderPage
    };

    const data = await pdfParse(pdfBuffer, options);

    // Handle fallback if pagerender did not capture any pages (e.g. edge cases)
    if (pageTexts.length === 0 && data.text) {
        pageTexts.push({
            pageNumber: 1,
            text: data.text.trim()
        });
    }

    // Sort pageTexts in ascending order since pages can resolve out-of-order in the pagerender promise
    pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);

    // Calculate total extracted character length to determine if OCR is needed
    const totalExtractedLength = pageTexts.reduce((sum, page) => sum + page.text.length, 0);
    const requiresOcr = totalExtractedLength < 50; // OCR needed if text is extremely sparse

    return {
        pages: pageTexts,
        numPages: data.numpages || pageTexts.length,
        requiresOcr,
        info: data.info || {}
    };
};

module.exports = {
    extractText
};
