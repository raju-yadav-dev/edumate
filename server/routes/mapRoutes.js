const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const { optionalAuthenticate } = authenticate;
const {
    getRoute,
    getNearby,
    getLocations,
    seedLocations
} = require("../controllers/mapController");

const router = express.Router();

// Direct API routes
router.post("/route", optionalAuthenticate, getRoute);
router.get("/nearby", optionalAuthenticate, getNearby);
router.get("/locations", optionalAuthenticate, getLocations);

// Admin-level seed trigger (or general bootstrap)
router.post("/locations/seed", seedLocations);

module.exports = router;
