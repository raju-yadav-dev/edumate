const { mapCategoryToDocumentType, normalizeDepartment } = require("./normalization");

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
    uploadedBy
}) => {
    const cleanCategory = String(category || "general").trim().toLowerCase();
    const docType = mapCategoryToDocumentType(cleanCategory);
    const cleanDept = normalizeDepartment(department);

    return {
        documentId: String(documentId || "").trim(),
        originalName: String(originalName || "").trim(),
        documentName: String(originalName || "").trim(),
        pageNumber: Number(pageNumber) || 1,
        page: Number(pageNumber) || 1,
        category: cleanCategory,
        documentType: docType,
        department: cleanDept,
        institution: String(institution || "").trim(),
        uploadedBy: String(uploadedBy || "").trim(),
        source: String(originalName || "").trim()
    };
};

module.exports = {
    buildMetadata
};
