const getMapService = () => require("../services/mapService");
const Location = require("../models/Location");
const locationHelper = require("../utils/locationHelper");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response");

// Brainware University main center point
const CAMPUS_DEFAULT_LAT = 22.7212;
const CAMPUS_DEFAULT_LNG = 88.4848;

/**
 * Direct route retrieval API endpoint
 */
const getRoute = asyncHandler(async (req, res) => {
    const { start, destination, startLat, startLng, destLat, destLng } = req.body;

    let startCoords = null;
    let destCoords = null;

    // Resolve Destination Coordinates
    if (destLat && destLng) {
        destCoords = { lat: Number(destLat), lng: Number(destLng), name: destination || "Destination" };
    } else if (destination) {
        try {
            const destRes = await locationHelper.resolveLocation(destination);
            destCoords = { lat: destRes.latitude, lng: destRes.longitude, name: destRes.name };
        } catch (e) {
            return sendError(res, 400, `Could not resolve destination: ${e.message}`);
        }
    } else {
        return sendError(res, 400, "Destination coordinates or name are required.");
    }

    // Resolve Starting Coordinates
    if (startLat && startLng) {
        startCoords = { lat: Number(startLat), lng: Number(startLng), name: start || "Start Location" };
    } else if (start) {
        try {
            const startRes = await locationHelper.resolveLocation(start);
            startCoords = { lat: startRes.latitude, lng: startRes.longitude, name: startRes.name };
        } catch (e) {
            return sendError(res, 400, `Could not resolve starting location: ${e.message}`);
        }
    } else {
        // Default to campus center
        startCoords = { lat: CAMPUS_DEFAULT_LAT, lng: CAMPUS_DEFAULT_LNG, name: "Campus Gate" };
    }

    // Validate coordinates strictly before passing to route calculation
    const isValidCoordinate = (coords) => {
        return coords && 
               typeof coords.lat === "number" && isFinite(coords.lat) && 
               typeof coords.lng === "number" && isFinite(coords.lng);
    };

    if (!isValidCoordinate(startCoords)) {
        return sendError(res, 400, `I couldn't find the starting location '${start || "Start Location"}'. Please provide a nearby landmark or a more specific location.`);
    }

    if (!isValidCoordinate(destCoords)) {
        return sendError(res, 400, `I couldn't find the destination '${destination || "Destination"}'. Please provide a nearby landmark or a more specific location.`);
    }

    const routes = await getMapService().calculateAndCacheRoutes(startCoords, destCoords);
    return sendSuccess(res, 200, "Routes calculated successfully.", {
        startLocation: startCoords,
        destination: destCoords,
        routes,
        excludedRoutes: routes.excludedRoutes || []
    });
});

/**
 * Direct nearby place search endpoint
 */
const getNearby = asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat) || CAMPUS_DEFAULT_LAT;
    const lng = Number(req.query.lng) || CAMPUS_DEFAULT_LNG;
    const type = req.query.type || "restaurants";
    const radius = Number(req.query.radius) || 2000;

    const places = await getMapService().findNearbyPlaces(lat, lng, type, radius);
    return sendSuccess(res, 200, "Nearby places fetched successfully.", {
        center: { lat, lng },
        type,
        radius,
        places
    });
});

/**
 * Fetch campus locations from database
 */
const getLocations = asyncHandler(async (req, res) => {
    const locations = await Location.find({}).sort({ name: 1 });
    return sendSuccess(res, 200, "Campus locations retrieved successfully.", locations);
});

/**
 * Seed initial campus locations for Brainware University
 */
const seedLocations = asyncHandler(async (req, res) => {
    const campusLocations = [
        { name: "Main Gate", latitude: 22.7203, longitude: 88.4851, type: "campus", description: "Primary entrance for students, staff, and visitors." },
        { name: "Admission Office", latitude: 22.7208, longitude: 88.4853, type: "campus", description: "Enquiries regarding admissions, registration, and forms." },
        { name: "Library", latitude: 22.7211, longitude: 88.4855, type: "campus", description: "Central university library with extensive reference and books collection." },
        { name: "Hostel", latitude: 22.7215, longitude: 88.4858, type: "campus", description: "Boys & Girls residential blocks inside campus." },
        { name: "Auditorium", latitude: 22.7213, longitude: 88.4850, type: "campus", description: "Main hall for cultural events, fests, and guest lectures." },
        { name: "Parking", latitude: 22.7201, longitude: 88.4849, type: "campus", description: "Two-wheeler and four-wheeler designated parking zone." },
        { name: "Accounts Office", latitude: 22.7209, longitude: 88.4854, type: "campus", description: "Tuition fee payment clearance counters." },
        { name: "Departments Block", latitude: 22.7210, longitude: 88.4852, type: "campus", description: "Engineering, Allied Sciences, and Humanities department HOD offices." },
        { name: "Canteen", latitude: 22.7214, longitude: 88.4856, type: "campus", description: "Main cafeteria offering hot meals and snacks." },
        { name: "Computer Lab", latitude: 22.7212, longitude: 88.4853, type: "campus", description: "Central computing center equipped with high-speed internet." },
        { name: "Medical Room", latitude: 22.7207, longitude: 88.4854, type: "campus", description: "First-aid medical room with nursing assistant." },
        { name: "Examination Cell", latitude: 22.7208, longitude: 88.4851, type: "campus", description: "Semester results, admit card distributions, and grade records." }
    ];

    // Clear existing and re-seed
    await Location.deleteMany({ type: "campus" });
    const inserted = await Location.insertMany(campusLocations);

    return sendSuccess(res, 201, "Campus locations database seeded successfully.", { count: inserted.length });
});

module.exports = {
    getRoute,
    getNearby,
    getLocations,
    seedLocations
};
