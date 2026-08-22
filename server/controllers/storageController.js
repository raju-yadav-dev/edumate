const {
    getCombinedStorage
} = require("../services/storageService");
const asyncHandler = require("../utils/asyncHandler");

const getStorageOverview = asyncHandler(async (req, res) => {
    const force = req.query.force === "true";
    const stats = await getCombinedStorage(force);

    return res.status(200).json({
        success: true,
        data: stats
    });
});

module.exports = {
    getStorageOverview
};