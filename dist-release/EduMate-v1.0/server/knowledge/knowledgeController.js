const SourcePriorityEngine = require("./SourcePriorityEngine");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

const getSources = asyncHandler(async (req, res) => {
    const sources = await SourcePriorityEngine.getSources();
    return sendSuccess(res, 200, "Knowledge sources retrieved successfully.", sources);
});

const updatePriorities = asyncHandler(async (req, res) => {
    const updated = await SourcePriorityEngine.updatePriorities(req.body.priorities);
    return sendSuccess(res, 200, "Source priorities updated successfully.", updated);
});

const updateSource = asyncHandler(async (req, res) => {
    const source = await SourcePriorityEngine.updateSource(req.params.id, req.body);
    return sendSuccess(res, 200, "Knowledge source updated successfully.", source);
});

const addWebsiteUrl = asyncHandler(async (req, res) => {
    const source = await SourcePriorityEngine.addWebsiteUrl({
        name: req.body.name,
        url: req.body.url,
        priority: req.body.priority
    });
    return sendSuccess(res, 201, "Website source added successfully.", source);
});

const deleteSource = asyncHandler(async (req, res) => {
    await SourcePriorityEngine.deleteSource(req.params.id);
    return sendSuccess(res, 200, "Website source deleted successfully.");
});

module.exports = {
    getSources,
    updatePriorities,
    updateSource,
    addWebsiteUrl,
    deleteSource
};
