const coreResponseFormatter = require("../../services/responseFormatter");

module.exports = {
    formatAnswer: coreResponseFormatter.formatAnswer,
    formatUnavailable: coreResponseFormatter.formatUnavailable,
    SOURCE_LABELS: coreResponseFormatter.SOURCE_LABELS
};
