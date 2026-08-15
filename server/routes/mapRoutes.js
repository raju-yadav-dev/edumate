const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");

const {
    optionalAuthenticate
} = authenticate;

const {
    getRoute,
    getNearby,
    getLocations,
    seedLocations
} = require("../controllers/mapController");

// Direct API routes

router.post(
    "/route",
    optionalAuthenticate,
    getRoute
);

router.get(
    "/nearby",
    optionalAuthenticate,
    getNearby
);

router.get(
    "/locations",
    optionalAuthenticate,
    getLocations
);

// Admin/bootstrap route
router.post(
    "/locations/seed",
    seedLocations
);

module.exports = router;