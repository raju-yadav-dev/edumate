const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

class ContentCleaner {
    /**
     * Parses page HTML and extracts clean, readable text
     * @param {string} html - HTML string of the webpage
     * @param {string} url - Source URL of the webpage
     * @returns {Object} - Parsed title, clean text content, and excerpt
     */
    static clean(html, url) {
        try {
            const dom = new JSDOM(html, { url });
            const doc = dom.window.document;

            // Remove print, print-only, skip links, and non-article elements from DOM before readability
            const elementsToRemove = doc.querySelectorAll("script, style, iframe, noscript, footer, header, nav");
            elementsToRemove.forEach(el => el.remove());

            const reader = new Readability(doc);
            const article = reader.parse();

            if (article) {
                // Remove redundant blank lines and spaces
                const cleanContent = (article.textContent || "")
                    .replace(/\r\n/g, "\n")
                    .replace(/\n\s*\n/g, "\n")
                    .replace(/[ \t]+/g, " ")
                    .trim();

                return {
                    title: article.title || doc.title || "Webpage",
                    content: cleanContent,
                    excerpt: article.excerpt || ""
                };
            }

            // Fallback: extract body text content directly if readability fails
            const bodyText = (doc.body?.textContent || "")
                .replace(/\s+/g, " ")
                .trim();

            return {
                title: doc.title || "Webpage",
                content: bodyText,
                excerpt: ""
            };
        } catch (err) {
            console.error(`[ContentCleaner] Readability/JSDOM parsing failed for ${url}:`, err.message);
            // Fallback bare regex string sanitization
            const stripTags = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            return {
                title: "Webpage",
                content: stripTags,
                excerpt: ""
            };
        }
    }
}

module.exports = ContentCleaner;
