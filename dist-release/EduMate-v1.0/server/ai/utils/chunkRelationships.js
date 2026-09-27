const crypto = require("crypto");

const deterministicChunkId = (documentId, index) => {
    const sha = crypto.createHash("sha256").update(`${documentId}:${index}`).digest("hex");
    return `${sha.slice(0, 8)}-${sha.slice(8, 12)}-4${sha.slice(13, 16)}-a${sha.slice(17, 20)}-${sha.slice(20, 32)}`;
};

const headingFromChunk = (content) => {
    const lines = String(content || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const heading = lines.find((line) => /^(?:#{1,6}\s+|\d+(?:\.\d+)*\s+[A-Z])/.test(line));
    return heading ? heading.replace(/^#{1,6}\s+/, "").trim() : "";
};

/**
 * Builds hierarchical section path (e.g. "Academics → BCA → Fees → Semester Fee" or "Faculty → CSS → Head of Department")
 */
const buildSectionPath = ({
    category = "Academics",
    program = "",
    department = "",
    parentHeading = "",
    heading = "",
    course = ""
} = {}) => {
    const segments = [];

    // Level 1: Category
    const cleanCategory = String(category || "Academics").trim();
    if (cleanCategory && cleanCategory.toLowerCase() !== "general") {
        segments.push(cleanCategory);
    }

    // Level 2: Program / Course
    const cleanProg = String(program || course || "").trim();
    if (cleanProg && !segments.includes(cleanProg)) {
        segments.push(cleanProg);
    }

    // Level 3: Department
    const cleanDept = String(department || "").trim();
    if (cleanDept && cleanDept.toLowerCase() !== "unknown" && !segments.includes(cleanDept)) {
        segments.push(cleanDept);
    }

    // Level 4: Parent Section / Heading
    const cleanParent = String(parentHeading || "").trim();
    if (cleanParent && cleanParent.toLowerCase() !== "document" && !segments.includes(cleanParent)) {
        segments.push(cleanParent);
    }

    // Level 5: Heading / Leaf Section
    const cleanHeading = String(heading || "").trim();
    if (cleanHeading && cleanHeading.toLowerCase() !== "document" && !segments.includes(cleanHeading)) {
        segments.push(cleanHeading);
    }

    if (segments.length === 0) {
        return "Document";
    }

    return segments.join(" → ");
};

/**
 * Builds lightweight chunk relationships establishing document hierarchy.
 */
const buildChunkRelationships = (chunks, chunkIds = [], options = {}) => {
    const documentId = options.documentId ? String(options.documentId) : "";
    let parentSection = options.parentSection || "Document";

    return (Array.isArray(chunks) ? chunks : []).map((chunk, index) => {
        const discoveredSection = headingFromChunk(chunk?.content || chunk);
        if (discoveredSection) parentSection = discoveredSection;

        const prevId = index > 0 ? (chunkIds[index - 1] || null) : null;
        const nextId = index < chunks.length - 1 ? (chunkIds[index + 1] || null) : null;

        return {
            parentDocument: documentId,
            parentSection,
            previousChunk: prevId,
            nextChunk: nextId,
            previousChunkId: prevId,
            nextChunkId: nextId,
            chunkLevel: 5,
            sectionOrder: index + 1
        };
    });
};

module.exports = {
    deterministicChunkId,
    headingFromChunk,
    buildSectionPath,
    buildChunkRelationships
};
