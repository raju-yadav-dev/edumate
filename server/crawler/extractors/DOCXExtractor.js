const mammoth = require("mammoth");
const cheerio = require("cheerio");

class DOCXExtractor {
    /**
     * Extracts text content from a Word (.docx) Buffer preserving headings and tables
     * @param {Buffer} buffer
     * @returns {Promise<Object>} - Contains { text, metadata, documentType }
     */
    static async extract(buffer) {
        if (!buffer || buffer.length === 0) {
            throw new Error("Cannot extract text from empty DOCX buffer.");
        }

        try {
            // First attempt: Convert to HTML to preserve headings and tables
            const result = await mammoth.convertToHtml({ buffer });
            const html = result.value || "";
            const warnings = result.warnings || [];

            if (!html.trim()) {
                // Fallback to raw text if HTML is empty
                const rawResult = await mammoth.extractRawText({ buffer });
                return {
                    text: (rawResult.value || "").trim(),
                    metadata: { warnings: rawResult.warnings || [], tableCount: 0 },
                    documentType: "docx"
                };
            }

            const $ = cheerio.load(html);
            let tableCount = 0;

            // Convert HTML tables to Markdown tables
            $("table").each((_, table) => {
                tableCount++;
                const rows = [];
                $(table).find("tr").each((_, tr) => {
                    const rowCells = [];
                    $(tr).find("th, td").each((_, cell) => {
                        const cellText = $(cell).text().trim().replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
                        rowCells.push(cellText || " ");
                    });
                    if (rowCells.length > 0) {
                        rows.push(rowCells);
                    }
                });

                if (rows.length > 0) {
                    const maxCols = Math.max(...rows.map((r) => r.length));
                    const normalizedRows = rows.map((r) => {
                        const copy = [...r];
                        while (copy.length < maxCols) copy.push(" ");
                        return copy;
                    });

                    let mdTable = "\n\n| " + normalizedRows[0].join(" | ") + " |\n";
                    mdTable += "| " + normalizedRows[0].map(() => "---").join(" | ") + " |\n";
                    for (let i = 1; i < normalizedRows.length; i++) {
                        mdTable += "| " + normalizedRows[i].join(" | ") + " |\n";
                    }
                    mdTable += "\n";
                    $(table).replaceWith(mdTable);
                }
            });

            // Convert headings to Markdown headings
            $("h1").each((_, el) => $(el).replaceWith(`\n\n# ${$(el).text().trim()}\n\n`));
            $("h2").each((_, el) => $(el).replaceWith(`\n\n## ${$(el).text().trim()}\n\n`));
            $("h3").each((_, el) => $(el).replaceWith(`\n\n### ${$(el).text().trim()}\n\n`));
            $("h4, h5, h6").each((_, el) => $(el).replaceWith(`\n\n#### ${$(el).text().trim()}\n\n`));
            $("p").each((_, el) => $(el).replaceWith(`\n${$(el).text().trim()}\n`));
            $("li").each((_, el) => $(el).replaceWith(`\n- ${$(el).text().trim()}`));

            let structuredText = $.text() || "";
            // Normalize extra whitespace while preserving paragraph and table structure
            structuredText = structuredText
                .replace(/\r\n/g, "\n")
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            return {
                text: structuredText,
                metadata: {
                    warnings,
                    tableCount
                },
                documentType: "docx"
            };
        } catch (err) {
            console.error("[DOCXExtractor] Failed to parse DOCX buffer:", err.message);
            throw new Error(`DOCX parsing failed: ${err.message}`);
        }
    }
}

module.exports = DOCXExtractor;
