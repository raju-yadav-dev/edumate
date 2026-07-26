/**
 * Standardizes metadata format for vector chunks to ensure schema consistency
 * @param {Object} params
 * @param {string} params.documentId
 * @param {string} params.originalName
 * @param {number} params.pageNumber
 * @param {string} params.category
 * @param {string} params.department
 * @param {string} params.institution
 * @param {string} params.uploadedBy
 * @returns {Object} - Formatted metadata dictionary
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
    return {
        documentId: String(documentId || "").trim(),
        originalName: String(originalName || "").trim(),
        pageNumber: Number(pageNumber) || 1,
        category: String(category || "others").trim().toLowerCase(),
        department: String(department || "").trim(),
        institution: String(institution || "").trim(),
        uploadedBy: String(uploadedBy || "").trim()
    };
};

module.exports = {
    buildMetadata
};
