/**
 * Production-grade document text cleaner and normalizer.
 * Normalizes extracted document text while retaining structural line
 * boundaries, tables, and bullet formatting. Removes OCR noise, hyphenation breaks,
 * and page furniture.
 */
class DocumentTextCleaner {
    static cleanText(text, options = {}) {
        if (typeof text !== "string") return "";

        // 1. Initial sanitization: control chars, replacement char, BOM
        let cleaned = text
            .replace(/\uFEFF/g, "")
            .replace(/\uFFFD/g, "")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
            .replace(/\r\n?/g, "\n");

        // 2. Fix broken hyphenated line wraps (e.g., "admis-\nsion" -> "admission")
        cleaned = cleaned.replace(/([A-Za-z]{2,})-\n\s*([A-Za-z]{2,})/g, "$1$2");

        // 3. Line normalization and noise filtering
        const lines = this.normalizeLines(cleaned);
        const repeatedLines = options.repeatedLines || new Set();

        const filteredLines = lines
            .filter((line) => !repeatedLines.has(this.lineKey(line)))
            .filter((line) => !this.isPageNumber(line))
            .filter((line) => !this.isWatermark(line))
            .filter((line) => !this.isOcrNoiseLine(line));

        return filteredLines
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    static cleanPages(pages) {
        if (!Array.isArray(pages)) return [];

        const normalizedPages = pages.map((page) => ({
            ...page,
            text: typeof page?.text === "string" ? page.text : ""
        }));
        const repeatedLines = this.findRepeatedPageFurniture(normalizedPages);

        return normalizedPages.map((page) => ({
            ...page,
            text: this.cleanText(page.text, { repeatedLines })
        }));
    }

    static normalizeLines(text) {
        return text
            .split("\n")
            .map((line) => {
                // If it's a table line or list, preserve leading/column delimiters
                if (line.trim().startsWith("|") || line.includes("|")) {
                    return line.replace(/[ \t\u00A0]+/g, " ").trim();
                }
                return line.replace(/[ \t\u00A0]+/g, " ").trim();
            })
            .filter((line) => line.length > 0);
    }

    static lineKey(line) {
        return line
            .normalize("NFKC")
            .toLocaleLowerCase()
            .replace(/[\s\u00A0]+/g, " ")
            .trim();
    }

    static findRepeatedPageFurniture(pages) {
        if (pages.length < 2) return new Set();

        const occurrences = new Map();
        pages.forEach((page) => {
            const lines = this.normalizeLines(page.text);
            const edgeLines = new Set([...lines.slice(0, 3), ...lines.slice(-3)]);
            edgeLines.forEach((line) => {
                const key = this.lineKey(line);
                if (!key || this.isPageNumber(line)) return;
                occurrences.set(key, (occurrences.get(key) || 0) + 1);
            });
        });

        const minimumPages = Math.max(2, Math.ceil(pages.length * 0.6));
        return new Set(
            [...occurrences.entries()]
                .filter(([, count]) => count >= minimumPages)
                .map(([key]) => key)
        );
    }

    static isPageNumber(line) {
        const value = line
            .replace(/[\u2012\u2013\u2014]/g, "-")
            .replace(/[()[\]{}]/g, "")
            .trim();

        return /^(?:page\s*)?(?:\d+|[ivxlcdm]+)(?:\s*(?:of|\/)\s*(?:\d+|[ivxlcdm]+))?$/i.test(value)
            || /^[-–—]?\s*(?:page\s*)?\d+\s*[-–—]?$/i.test(value);
    }

    static isWatermark(line) {
        const key = this.lineKey(line);
        if (!key || key.length > 80) return false;
        return /\b(?:watermark|confidential|copyright|draft|do not distribute|sample copy|internal use only)\b/i.test(key);
    }

    static isOcrNoiseLine(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0) return true;

        // Table borders, markdown dividers, horizontal rules should be kept
        if (/^[-=_*]{3,}$/.test(trimmed) || /^\|?[-:\s|]+\|?$/.test(trimmed)) {
            return false;
        }

        // Stray isolated symbols (e.g. single punctuation characters or noise tokens like "~ _ | ~")
        if (/^[^a-zA-Z0-9]{1,3}$/.test(trimmed)) {
            return true;
        }

        // Repeating random symbols like "§§§" or "|||||||"
        if (/^([^\w\s])\1{4,}$/.test(trimmed)) {
            return true;
        }

        // Character density check: lines with letters/digits less than 20% of length (unless it's a table/separator)
        const alphaNumCount = (trimmed.match(/[a-zA-Z0-9\u0900-\u097F]/g) || []).length;
        if (trimmed.length > 10 && (alphaNumCount / trimmed.length) < 0.20 && !trimmed.includes("|")) {
            return true;
        }

        return false;
    }
}

module.exports = DocumentTextCleaner;
