const { countTokens } = require("./tokenizer");

/**
 * Production-Quality Semantic & Structure-Aware Chunker.
 *
 * Rules:
 * 1. Semantic split on headings, subheadings, sections, tables, lists, notices, faculty, fees, hostel, admissions.
 * 2. Never split a table across chunks (atomic tables).
 * 3. Never mix two unrelated headings into the same chunk (flush on heading boundary).
 * 4. Target chunk size ~250-450 tokens (~1000-1800 chars).
 * 5. Allow larger chunks only for atomic tables and long structured lists.
 * 6. Preserve formatting for bullet lists and numbered steps.
 * 7. Track and preserve section hierarchy and headings.
 */
class StructureAwareChunker {
    constructor({
        minTokens = 80,
        preferredMinTokens = 250,
        preferredMaxTokens = 450,
        maxTokens = 600,
        overlapTokens = 30
    } = {}) {
        this.minTokens = minTokens;
        this.preferredMinTokens = preferredMinTokens;
        this.preferredMaxTokens = preferredMaxTokens;
        this.maxTokens = maxTokens;
        this.overlapTokens = overlapTokens;

        // Character approximations (~4 chars per token)
        this.minChars = minTokens * 4;
        this.preferredMinChars = preferredMinTokens * 4;
        this.preferredMaxChars = preferredMaxTokens * 4;
        this.maxChars = maxTokens * 4;
        this.overlapChars = overlapTokens * 4;
    }

    /**
     * Splits structured text into semantic chunks.
     * @param {string} text
     * @returns {Array<string>}
     */
    splitText(text) {
        if (!text || typeof text !== "string") return [];

        const normalized = text.replace(/\r\n?/g, "\n");
        const lines = normalized.split("\n");
        const blocks = this.parseBlocks(lines);

        const chunks = [];
        let currentSection = [];
        let currentHeading = "Document";

        const flushSection = () => {
            if (currentSection.length > 0) {
                const packed = this.packBlocks(currentSection, currentHeading);
                chunks.push(...packed);
                currentSection = [];
            }
        };

        for (const block of blocks) {
            // If we encounter a new major or explicit heading, flush previous section
            if (block.type === "heading" || block.boundary) {
                if (currentSection.length > 0) {
                    flushSection();
                }
                currentHeading = block.headingText || block.text;
            }
            currentSection.push(block);
        }

        flushSection();
        return chunks.filter(c => c && c.trim().length > 0);
    }

    /**
     * Parses raw lines into typed semantic blocks:
     * - heading (markdown, numbered, domain section)
     * - table (markdown pipe table, tab-separated table)
     * - list (bulleted list, numbered sequence)
     * - paragraph (standard text)
     */
    parseBlocks(lines) {
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed) {
                i++;
                continue;
            }

            const explicitHeading = this.isExplicitHeading(trimmed);
            const domainHeading = this.isDomainSectionHeading(trimmed);
            const tableHeading = this.isStructuredTableHeading(trimmed);
            const isTableLine = this.isTable(trimmed);
            const isListLine = this.isList(trimmed);

            if (tableHeading) {
                // Table with preceding title
                const headingLine = trimmed;
                i++;
                const tableLines = [];
                while (i < lines.length) {
                    const next = lines[i].trim();
                    if (!next) {
                        i++;
                        // If empty line but table continues next, stay in table
                        if (i < lines.length && this.isTable(lines[i].trim())) continue;
                        break;
                    }
                    if (!this.isTable(next)) break;
                    tableLines.push(next);
                    i++;
                }

                const tableContent = tableLines.length > 0
                    ? headingLine + "\n\n" + this.toMarkdownTable(tableLines)
                    : headingLine;

                blocks.push({
                    type: "table",
                    text: tableContent,
                    headingText: headingLine,
                    boundary: true,
                    atomic: true
                });
                continue;
            }

            if (isTableLine) {
                // Table block without explicit table heading
                const tableLines = [trimmed];
                i++;
                while (i < lines.length) {
                    const next = lines[i].trim();
                    if (!next) {
                        i++;
                        if (i < lines.length && this.isTable(lines[i].trim())) continue;
                        break;
                    }
                    if (!this.isTable(next)) break;
                    tableLines.push(next);
                    i++;
                }

                blocks.push({
                    type: "table",
                    text: this.toMarkdownTable(tableLines),
                    boundary: false,
                    atomic: true
                });
                continue;
            }

            if (explicitHeading || domainHeading) {
                const headingText = trimmed.replace(/^#{1,6}\s+/, "").trim();
                blocks.push({
                    type: "heading",
                    text: trimmed,
                    headingText: headingText,
                    boundary: true
                });
                i++;
                continue;
            }

            if (isListLine) {
                const listLines = [line]; // preserve original line indentation
                i++;
                while (i < lines.length) {
                    const nextRaw = lines[i];
                    const nextTrimmed = nextRaw.trim();
                    if (!nextTrimmed) {
                        i++;
                        // Check if list continues after blank line
                        if (i < lines.length && (this.isList(lines[i].trim()) || /^\s{2,}/.test(lines[i]))) continue;
                        break;
                    }
                    if (this.isExplicitHeading(nextTrimmed) || this.isDomainSectionHeading(nextTrimmed) || this.isTable(nextTrimmed)) {
                        break;
                    }
                    listLines.push(nextRaw);
                    i++;
                }

                blocks.push({
                    type: "list",
                    text: listLines.join("\n"),
                    boundary: false,
                    atomic: listLines.length <= 15
                });
                continue;
            }

            // Paragraph block
            const paraLines = [trimmed];
            i++;
            while (i < lines.length) {
                const nextRaw = lines[i];
                const nextTrimmed = nextRaw.trim();
                if (!nextTrimmed) break;
                if (this.isExplicitHeading(nextTrimmed) ||
                    this.isDomainSectionHeading(nextTrimmed) ||
                    this.isStructuredTableHeading(nextTrimmed) ||
                    this.isTable(nextTrimmed) ||
                    this.isList(nextTrimmed)) {
                    break;
                }
                paraLines.push(nextTrimmed);
                i++;
            }

            blocks.push({
                type: "paragraph",
                text: paraLines.join(" "),
                boundary: false
            });
        }

        return blocks;
    }

    /**
     * Packs blocks belonging to a section into optimal chunks (~250-450 tokens).
     */
    packBlocks(blocks, sectionHeading) {
        const chunks = [];
        let currentBlocks = [];
        let currentTokens = 0;

        const flushCurrent = () => {
            if (currentBlocks.length > 0) {
                const chunkText = currentBlocks.map(b => b.text).join("\n\n").trim();
                if (chunkText) {
                    chunks.push(chunkText);
                }
                currentBlocks = [];
                currentTokens = 0;
            }
        };

        for (const block of blocks) {
            const blockTokens = countTokens(block.text);

            // 1. If block is an atomic table or structured list:
            if (block.atomic) {
                if (currentBlocks.length > 0) {
                    // If current buffer already reached preferred minimum or adding this table exceeds max, flush buffer first
                    if (currentTokens >= this.preferredMinTokens || (currentTokens + blockTokens > this.maxTokens)) {
                        flushCurrent();
                    }
                }

                // If standalone atomic block is large, emit as standalone chunk
                if (currentBlocks.length === 0 && blockTokens >= this.preferredMaxTokens) {
                    chunks.push(block.text.trim());
                    continue;
                }

                currentBlocks.push(block);
                currentTokens += blockTokens;
                continue;
            }

            // 2. Large paragraph splitting by sentence:
            if (block.type === "paragraph" && blockTokens > this.preferredMaxTokens) {
                const sentences = this.splitSentences(block.text);
                for (const sentence of sentences) {
                    const sentenceTokens = countTokens(sentence);
                    if (currentBlocks.length > 0 && (currentTokens + sentenceTokens > this.preferredMaxTokens)) {
                        flushCurrent();
                    }
                    currentBlocks.push({ type: "paragraph", text: sentence });
                    currentTokens += sentenceTokens;
                }
                continue;
            }

            // 3. Regular block:
            if (currentBlocks.length > 0 && (currentTokens + blockTokens > this.preferredMaxTokens)) {
                flushCurrent();
            }

            currentBlocks.push(block);
            currentTokens += blockTokens;
        }

        flushCurrent();
        return chunks;
    }

    splitSentences(text) {
        const matches = text.match(/[^.!?।]+[.!?।]+(?:\s+|$)|.+$/g) || [text];
        const results = [];
        let buffer = "";

        for (const part of matches.map(p => p.trim()).filter(Boolean)) {
            if (buffer && countTokens(buffer + " " + part) > this.preferredMaxTokens) {
                results.push(buffer);
                buffer = part;
            } else {
                buffer = buffer ? buffer + " " + part : part;
            }
        }
        if (buffer) results.push(buffer);
        return results;
    }

    toMarkdownTable(lines) {
        const rows = lines
            .filter((line) => !this.isTableSeparator(line))
            .map((line) => line.split(line.includes("|") ? "|" : /\t+/).map((cell) => cell.trim()).filter(Boolean));

        if (!rows.length) return lines.join("\n");

        const width = Math.max(...rows.map((row) => row.length));
        const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
        const header = normalized[0];
        const separator = header.map(() => "---");
        return [header, separator, ...normalized.slice(1)]
            .map((row) => "| " + row.join(" | ") + " |")
            .join("\n");
    }

    isTableSeparator(line) {
        const cells = line.split(line.includes("|") ? "|" : /\t+/).map((cell) => cell.trim()).filter(Boolean);
        return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
    }

    isTable(line) {
        return (line.includes("|") && line.split("|").length >= 3)
            || (line.includes("\t") && line.split(/\t+/).length >= 2);
    }

    isList(line) {
        return /^(?:[-*+•]|\d+[.)]|[A-Za-z][.)]|[ivxlcdm]+[.)])\s+/i.test(line);
    }

    isStructuredTableHeading(line) {
        return /\b(?:fee\s+structure|fee\s+table|tuition\s+fees|fee\s+schedule|timetable|time\s+table|schedule\s+of\s+fees|hostel\s+fee|admission\s+fees?|salary\s+breakup|placement\s+table|course\s+schedule)\b/i.test(line)
            && !/[.!?]$/.test(line);
    }

    isDomainSectionHeading(line) {
        if (!line || this.isList(line) || this.isTable(line) || line.length > 120 || /[.!?]$/.test(line)) return false;

        const patterns = [
            /\b(?:admission|admissions|eligibility|application\s+procedure|selection\s+criteria)\b/i,
            /\b(?:fee\s+structure|tuition\s+fees|hostel\s+fee|payment\s+schedule|refund\s+policy)\b/i,
            /\b(?:faculty|professors?|head\s+of\s+department|hod|dean|teaching\s+staff)\b/i,
            /\b(?:syllabus|curriculum|course\s+structure|subjects?|semester\s+[0-9ivx]+)\b/i,
            /\b(?:hostel\s+rules|hostel\s+regulations|mess\s+rules|accommodation)\b/i,
            /\b(?:placement\s+records?|placements|recruiters|career\s+services)\b/i,
            /\b(?:scholarships?|financial\s+aid|fee\s+waiver|fellowship)\b/i,
            /\b(?:notices?|announcements?|circulars?|important\s+dates|events?)\b/i,
            /\b(?:department\s+of\s+[A-Za-z\s]+|school\s+of\s+[A-Za-z\s]+)\b/i
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    isExplicitHeading(line) {
        if (!line || this.isList(line) || this.isTable(line)) return false;
        if (/^#{1,6}\s+/.test(line)) return true;
        if (/^\d+(?:\.\d+)*\s+[A-Z]/.test(line)) return true;
        if (/^(?:Section|Chapter|Part|Module|Unit|Semester)\s+[0-9IVX]+/i.test(line)) return true;
        if (/^[A-Z\s]{4,60}$/.test(line) && !line.includes(",") && !line.includes(".")) return true;
        return false;
    }

    isHeading(line) {
        if (this.isList(line) || this.isTable(line) || line.length > 140) return false;
        return this.isExplicitHeading(line) || this.isDomainSectionHeading(line);
    }
}

module.exports = StructureAwareChunker;
