const { mapCategoryToDocumentType, normalizeDepartment } = require("./normalization");
const { resolveKnowledgeCategory } = require("./knowledgeCategory");
const { extractSearchMetadata } = require("./keywordEntityExtractor");
const { buildSectionPath } = require("./chunkRelationships");

const headingFromChunk = (content) => {
    const lines = String(content || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const heading = lines.find((line) => /^(?:#{1,6}\s+|\d+(?:\.\d+)*\s+[A-Z])/.test(line));
    return heading ? heading.replace(/^#{1,6}\s+/, "").trim() : "";
};

const extractUploadFolder = (storagePath, folder) => {
    if (folder && typeof folder === "string" && folder.trim()) {
        return folder.trim();
    }
    if (storagePath && typeof storagePath === "string") {
        const parts = storagePath.replace(/\\/g, "/").split("/").filter(Boolean);
        if (parts.length > 1) {
            return parts[0];
        }
    }
    return "documents";
};

/**
 * Standardizes metadata format for vector chunks to ensure schema consistency
 */
const buildMetadata = ({
    documentId,
    originalName,
    pageNumber,
    category,
    department,
    institution,
    uploadedBy,
    folder,
    storagePath
}) => {
    const detectedCategory = resolveKnowledgeCategory({
        storagePath,
        folder,
        documentCategory: category,
        originalName
    });
    const cleanCategory = String(detectedCategory || category || "general").trim();
    const docType = mapCategoryToDocumentType(cleanCategory);
    const cleanDept = normalizeDepartment(department);
    const uploadFolder = extractUploadFolder(storagePath, folder);

    return {
        documentId: String(documentId || "").trim(),
        originalName: String(originalName || "").trim(),
        documentName: String(originalName || "").trim(),
        filename: String(originalName || "").trim(),
        source: String(originalName || "").trim(),
        pageNumber: Number(pageNumber) || 1,
        page: Number(pageNumber) || 1,
        category: cleanCategory,
        documentType: docType,
        department: cleanDept,
        institution: String(institution || "").trim(),
        uploadedBy: String(uploadedBy || "").trim(),
        uploadFolder: uploadFolder,
        folder: uploadFolder
    };
};

/**
 * Builds comprehensive, rich metadata for every chunk, including full document hierarchy.
 */
const buildChunkMetadata = ({
    documentId,
    chunkId,
    content,
    chunkIndex = 0,
    pageNumber = 1,
    originalName = "",
    storagePath = "",
    folder = "",
    documentCategory = "",
    department = "",
    institution = "",
    uploadedBy = "",
    parentSection = "Document",
    searchMetadata = null,
    relationships = null,
    campusMeta = null,
    isImage = false,
    mimeType = ""
}) => {
    const searchMeta = searchMetadata || extractSearchMetadata(content, { originalName });
    const detectedCategory = resolveKnowledgeCategory({
        storagePath,
        folder,
        documentCategory,
        originalName
    });

    const uploadFolder = extractUploadFolder(storagePath, folder);
    const immediateHeading = headingFromChunk(content);
    const resolvedParentHeading = relationships?.parentSection || parentSection || "Document";
    const heading = immediateHeading || resolvedParentHeading || "Document";

    const detectedDept = (searchMeta.departments && searchMeta.departments.length > 0 ? searchMeta.departments[0] : "") ||
        (campusMeta?.description) ||
        normalizeDepartment(department) || "";

    const detectedProg = (searchMeta.programs && searchMeta.programs.length > 0 ? searchMeta.programs[0] : "") || "";

    const cleanCategory = detectedCategory || "Academics";
    const docType = searchMeta.documentType || (isImage ? "image" : mapCategoryToDocumentType(cleanCategory));

    // Hierarchical section path (Document -> Category -> Section -> Subsection -> Chunk)
    const sectionPath = buildSectionPath({
        category: cleanCategory,
        program: detectedProg,
        department: detectedDept,
        parentHeading: resolvedParentHeading,
        heading: heading
    });

    const prevChunkId = relationships?.previousChunk || relationships?.previousChunkId || null;
    const nextChunkId = relationships?.nextChunk || relationships?.nextChunkId || null;
    const parentDoc = String(relationships?.parentDocument || documentId || "");

    return {
        // Core Identifiers
        chunkId: String(chunkId || ""),
        sourceDocumentId: String(documentId || ""),
        documentId: String(documentId || ""),

        // Task 2 & Task 3 Hierarchical Metadata Fields
        category: cleanCategory,
        department: detectedDept,
        program: detectedProg,
        course: detectedProg,
        documentType: docType,
        heading: heading,
        parentHeading: resolvedParentHeading,
        parentSection: resolvedParentHeading,
        parentDocument: parentDoc,
        previousChunk: prevChunkId,
        nextChunk: nextChunkId,
        previousChunkId: prevChunkId,
        nextChunkId: nextChunkId,
        chunkLevel: 5,
        sectionPath: sectionPath,
        pageNumber: Number(pageNumber) || 1,
        keywords: Array.isArray(searchMeta.keywords) ? searchMeta.keywords : [],
        filename: String(originalName || "").trim(),
        originalName: String(originalName || "").trim(),
        documentName: String(originalName || "").trim(),
        source: String(originalName || "").trim(),
        uploadFolder: uploadFolder,
        folder: uploadFolder,
        chunkOrder: Number(chunkIndex) + 1,
        chunkIndex: Number(chunkIndex),
        sectionOrder: Number(chunkIndex) + 1,

        // Context & Academic Metadata
        institution: String(institution || "").trim(),
        uploadedBy: String(uploadedBy || "").trim(),
        programs: searchMeta.programs || [],
        departments: searchMeta.departments || [],
        semesters: searchMeta.semesters || [],
        subjects: searchMeta.subjects || [],
        feeKeywords: searchMeta.feeKeywords || [],
        facultyNames: searchMeta.facultyNames || [],
        hostelKeywords: searchMeta.hostelKeywords || [],
        sourceType: isImage ? "image" : (campusMeta ? "campus_navigation" : "document"),
        mimeType: mimeType || undefined,
        buildingNumber: campusMeta?.buildingNumber || undefined,
        buildingName: campusMeta?.buildingName || undefined,
        floor: campusMeta?.floor || undefined,
        roomNumber: campusMeta?.roomNumber || undefined
    };
};

module.exports = {
    buildMetadata,
    buildChunkMetadata,
    buildSectionPath
};
