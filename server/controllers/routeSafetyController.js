const {
  evaluateRoutes,
} = require("../services/routeSafetyService");
const asyncHandler = require("../utils/asyncHandler");

const evaluateRouteSafety = asyncHandler(async (req, res, next) => {
  const { routes } = req.body;

  if (!Array.isArray(routes) || routes.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one route is required.",
    });
  }

  const result = await evaluateRoutes(routes, {
    maxSamplePoints: 25,
    radiusMeters: 50,
  });

  return res.json({
    success: true,
    ...result,
  });
});

module.exports = {
  evaluateRouteSafety,
};