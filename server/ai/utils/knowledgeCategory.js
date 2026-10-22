const KNOWLEDGE_CATEGORIES = Object.freeze([
    "Academics",
    "Admissions",
    "Faculty",
    "Hostel",
    "Campus",
    "Brochure",
    "Notices",
    "Crawled",
    "Temporary",
    "Trash"
]);

const CATEGORY_ALIASES = new Map([
    ["academics", "Academics"],
    ["academic", "Academics"],
    ["admissions", "Admissions"],
    ["admission", "Admissions"],
    ["faculty", "Faculty"],
    ["hostel", "Hostel"],
    ["campus", "Campus"],
    ["brochure", "Brochure"],
    ["notices", "Notices"],
    ["notice", "Notices"],
    ["crawled", "Crawled"],
    ["crawler", "Crawled"],
    ["temporary", "Temporary"],
    ["temp", "Temporary"],
    ["trash", "Trash"]
]);

const CONTENT_RULES = [
    ["Trash", /\b(?:trash|deleted|recycle|bin)\b/i],
    ["Temporary", /\b(?:temporary|temp|tmp|staging)\b/i],
    ["Crawled", /\b(?:crawled|crawler|webcrawl|scraped)\b/i],
    ["Faculty", /\b(?:faculty|professor|teacher|staff|hod)\b/i],
    ["Hostel", /\b(?:hostel|accommodation|residence|mess|dorm)\b/i],
    ["Admissions", /\b(?:admission|application|enroll|eligib(?:ility|le)|entrance)\b/i],
    ["Brochure", /\b(?:brochure|prospectus|catalogue|catalog)\b/i],
    ["Notices", /\b(?:notices?|notification|circular|announcement)\b/i],
    ["Campus", /\b(?:campus|building|facility|navigation|location|map)\b/i],
    ["Academics", /\b(?:academic|course|curriculum|syllabus|subject|semester|program|department)\b/i]
];

const toText = (value) => (value === null || value === undefined ? "" : String(value));

const pathSegments = (value) => toText(value)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

const resolveKnowledgeCategory = ({
    storagePath = "",
    folder = "",
    documentCategory = "",
    originalName = "",
    metadata = {}
} = {}) => {
    if (documentCategory) {
        const exactCat = CATEGORY_ALIASES.get(toText(documentCategory).trim().toLowerCase());
        if (exactCat) return exactCat;
    }

    const storagePathParts = pathSegments(storagePath);
    const lastPathPart = storagePathParts[storagePathParts.length - 1] || "";
    const storageFolders = storagePathParts.length > 1 && /\.[a-z0-9]{1,8}$/i.test(lastPathPart)
        ? storagePathParts.slice(0, -1)
        : storagePathParts;
    const storageSegments = [...storageFolders, ...pathSegments(folder)];

    for (const segment of storageSegments) {
        const exactCategory = CATEGORY_ALIASES.get(segment.replace(/[_-]+/g, " ").trim().replace(/\s+/g, " "));
        if (exactCategory) return exactCategory;
    }

    const sourceMetadata = metadata && typeof metadata === "object" ? metadata : {};
    if (sourceMetadata.uploadedFrom === "crawler" || sourceMetadata.sourceUrl) {
        return "Crawled";
    }

    const sourceText = [documentCategory, originalName, ...storageSegments].map(toText).join(" ").replace(/[_\-.]+/g, " ");
    for (const [category, rule] of CONTENT_RULES) {
        if (rule.test(sourceText)) return category;
    }

    return "Academics";
};

module.exports = {
    KNOWLEDGE_CATEGORIES,
    resolveKnowledgeCategory
};
