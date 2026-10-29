const normalize = (value) => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isOnlyPageNumber = (text) => /^(?:page\s*)?(?:\d+|[ivxlcdm]+)(?:\s*(?:of|\/)\s*(?:\d+|[ivxlcdm]+))?$/i.test(
    text.replace(/[()\[\]{}]/g, "").trim()
);

const isOnlyHeaderFooter = (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 3 || text.length > 140) return false;
    return lines.every((line) => /^(?:header|footer|page header|page footer|confidential|draft|watermark)\b/i.test(line));
};

const isOcrGarbage = (text) => {
    if (/[\uFFFD]/.test(text)) return true;
    if (/\b(?:ocr failed|text extraction unavailable|unreadable file)\b/i.test(text)) return true;

    const lettersAndNumbers = (text.match(/[\p{L}\p{N}]/gu) || []).length;
    const meaningful = text.replace(/[\s\p{P}\p{S}]/gu, "");
    if (lettersAndNumbers / Math.max(text.length, 1) < 0.35) return true;
    return /(.)\1{7,}/u.test(text) || /(?:[^\s\p{L}\p{N}]){8,}/u.test(text);
};

const validateChunk = (chunk) => {
    const content = typeof chunk === "string" ? chunk : chunk?.content;
    const text = String(content || "").trim();
    if (!text) return { valid: false, reason: "empty" };
    if (isOnlyPageNumber(text)) return { valid: false, reason: "page-number-only" };
    if (isOnlyHeaderFooter(text)) return { valid: false, reason: "header-footer-only" };
    if (isOcrGarbage(text)) return { valid: false, reason: "ocr-garbage" };
    if (text.length < 50) {
        // Valid short chunks contain key-value facts, numbers/dates, table rows, or list entries
        const hasKeyValue = /\b[A-Za-z0-9\s()/-]{2,25}\s*:\s*\S+/.test(text);
        const hasTableSyntax = text.includes("|") || /\S+\s{2,}\S+/.test(text);
        const hasFactualNumbers = /\d+/.test(text) && text.length >= 15;
        const isStructuredBullet = /^[-*•]\s+\S+/.test(text) && text.length >= 20;

        if (!hasKeyValue && !hasTableSyntax && !hasFactualNumbers && !isStructuredBullet) {
            return { valid: false, reason: "incomplete-fragment" };
        }
    }
    return { valid: true, text };
};

const validateChunks = (chunks) => {
    const seen = new Set();
    const validChunks = [];
    const rejected = [];

    for (const chunk of Array.isArray(chunks) ? chunks : []) {
        const result = validateChunk(chunk);
        if (!result.valid) {
            rejected.push({ chunk, reason: result.reason });
            continue;
        }

        const key = normalize(result.text);
        if (seen.has(key)) {
            rejected.push({ chunk, reason: "duplicate-content" });
            continue;
        }
        seen.add(key);
        validChunks.push(typeof chunk === "string" ? result.text : { ...chunk, content: result.text });
    }

    const reasons = rejected.reduce((counts, item) => {
        counts[item.reason] = (counts[item.reason] || 0) + 1;
        return counts;
    }, {});
    return { validChunks, rejected, reasons };
};

module.exports = { validateChunk, validateChunks };
