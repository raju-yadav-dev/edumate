const coreResponseFormatter = require("../../services/responseFormatter");

module.exports = {
    formatAnswer: coreResponseFormatter.formatAnswer,
    formatUnavailable: coreResponseFormatter.formatUnavailable,
    detectFormatType: coreResponseFormatter.detectFormatType,
    deduplicateContent: coreResponseFormatter.deduplicateContent,
    repairMarkdownTable: coreResponseFormatter.repairMarkdownTable,
    preserveOriginalTables: coreResponseFormatter.preserveOriginalTables,
    applyUniversityTemplate: coreResponseFormatter.applyUniversityTemplate,
    breakGiantParagraph: coreResponseFormatter.breakGiantParagraph,
    attachSectionMetadata: coreResponseFormatter.attachSectionMetadata,
    applyConfidenceNotice: coreResponseFormatter.applyConfidenceNotice,
    sanitizeMarkdown: coreResponseFormatter.sanitizeMarkdown,
    FORMAT_TYPES: coreResponseFormatter.FORMAT_TYPES,
    SOURCE_LABELS: coreResponseFormatter.SOURCE_LABELS
};
