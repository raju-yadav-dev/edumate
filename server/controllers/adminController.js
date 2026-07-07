const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const settingsService = require("../services/settingsService");

const saveApiKeys = asyncHandler(async (req, res) => {
    const settings = await settingsService.saveApiKeys({
        groqApiKeys: req.body.groqApiKeys || [],
        openRouteServiceApiKey: req.body.openRouteServiceApiKey,
        user: req.user
    });

    return sendSuccess(res, 200, "Provider API keys saved successfully.", settings);
});

module.exports = {
    saveApiKeys
};
