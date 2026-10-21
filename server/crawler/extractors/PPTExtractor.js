const officeparser = require("officeparser");

function extractNodeText(node) {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.children)) {
        return node.children.map(extractNodeText).filter(Boolean).join(" ");
    }
    return "";
}

class PPTExtractor {
    /**
     * Extracts text content from a PowerPoint (.pptx/.ppt) presentation buffer
     * @param {Buffer} buffer
     * @param {string} fileExt - Optional extension to distinguish type
     * @returns {Promise<Object>} - Contains { text, metadata: { slideCount, slides }, documentType }
     */
    static async extract(buffer, fileExt = "pptx") {
        if (!buffer || buffer.length === 0) {
            throw new Error("Cannot extract text from empty presentation buffer.");
        }

        try {
            const parsed = await officeparser.parseOffice(buffer);
            const slides = [];
            let fullText = "";

            if (parsed && Array.isArray(parsed.content)) {
                parsed.content.forEach((slideNode, index) => {
                    const slideText = extractNodeText(slideNode).replace(/\s+/g, " ").trim();
                    if (slideText) {
                        slides.push({
                            slideNumber: index + 1,
                            text: slideText
                        });
                        fullText += `--- Slide ${index + 1} ---\n${slideText}\n\n`;
                    }
                });
            } else if (typeof parsed === "string") {
                fullText = parsed.trim();
                slides.push({ slideNumber: 1, text: fullText });
            }

            if (!fullText.trim()) {
                throw new Error("Presentation contains no extractable text content.");
            }

            return {
                text: fullText.trim(),
                metadata: {
                    slideCount: slides.length,
                    slides
                },
                documentType: fileExt
            };
        } catch (err) {
            console.error(`[PPTExtractor] Failed to parse ${fileExt} buffer:`, err.message);
            throw new Error(`${fileExt.toUpperCase()} parsing failed: ${err.message}`);
        }
    }
}

module.exports = PPTExtractor;
