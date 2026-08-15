const {
  evaluateRoutes,
} = require("../services/routeSafetyService");

async function evaluateRouteSafety(req, res, next) {
  try {
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
  } catch (error) {
    next(error);
  }
}

module.exports = {
  evaluateRouteSafety,
};