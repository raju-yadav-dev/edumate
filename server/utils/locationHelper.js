const Location = require("../models/Location");

/**
 * Calculates the great-circle distance between two points on the Earth's surface using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Performs a search in the local MongoDB locations database
 * @param {string} name - The name of the campus location to search for
 * @returns {Promise<Object|null>} - Returns the location document or null
 */
async function lookupCampusLocation(name) {
    if (!name) return null;
    let cleanName = name.trim().toLowerCase();

    // Map building terms to campus database nodes
    if (cleanName.includes("building 2") || cleanName.includes("vidyasagar")) {
        cleanName = "admission office";
    } else if (cleanName.includes("library")) {
        cleanName = "library";
    } else if (cleanName.includes("examination")) {
        cleanName = "examination cell";
    } else if (cleanName.includes("accounts")) {
        cleanName = "accounts office";
    } else if (cleanName.includes("building") || cleanName.includes("bhavan") || cleanName.includes("bhawan")) {
        cleanName = "departments block";
    }

    // Try an exact match first
    let loc = await Location.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, "i") } });
    if (loc) return loc;

    // Try a partial/regex match
    loc = await Location.findOne({ name: { $regex: new RegExp(cleanName, "i") } });
    return loc;
}

/**
 * Geocodes an address string using Nominatim OpenStreetMap API.
 * @param {string} query - The query address to geocode
 * @returns {Promise<Object>} - { name, latitude, longitude }
 */
async function geocode(query) {
    if (!query) throw new Error("Query is required for geocoding.");

    // Clean up query
    let searchQuery = query.trim();

    // Map spelling variations
    searchQuery = searchQuery.replace(/shyamnager/gi, "Shyamnagar");
    searchQuery = searchQuery.replace(/bhadreshware/gi, "Bhadreswar");
    searchQuery = searchQuery.replace(/bhadreswar/gi, "Bhadreswar");


    // To prevent getting results from other parts of the world for common local place names,
    // we append "Kolkata, West Bengal, India" if there is no mention of "kolkata" or "india" or "bengal" in the query.
    const lowerQuery = searchQuery.toLowerCase();
    if (!lowerQuery.includes("kolkata") && !lowerQuery.includes("india") && !lowerQuery.includes("bengal") && !lowerQuery.includes("barasat")) {
        searchQuery += ", West Bengal, India";
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "EduMateCampusApp/1.0 (contact@edumate.edu)",
                "Accept-Language": "en"
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim geocoding failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            throw new Error(`No location found for query: "${query}"`);
        }

        return {
            name: data[0].display_name,
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon)
        };
    } catch (error) {
        console.error("Error during geocoding query:", query, error.message);
        throw error;
    }
}

/**
 * Reverse geocodes coordinates to a location name.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Display name of coordinates
 */
async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "EduMateCampusApp/1.0 (contact@edumate.edu)",
                "Accept-Language": "en"
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim reverse geocoding failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error("Error in reverse geocoding:", lat, lng, error.message);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

/**
 * Resolves a place name to coordinates. Checks database first, then Nominatim.
 * @param {string} queryName - Location name
 * @returns {Promise<Object>} - { name, latitude, longitude, source }
 */
async function resolveLocation(queryName) {
    if (!queryName) throw new Error("Location query is required.");

    // Robust local dictionary for common geocoding locations
    const cleanQuery = queryName.trim().toLowerCase();
    const fallbackLocations = {
        "bhadreshware": {
            name: "Bhadreswar Municipal Hospital, Grand Trunk Road, Chandannagar, Kolkata Metropolitan Area, Singur, Hooghly, West Bengal, 712125, India",
            latitude: 22.8310988,
            longitude: 88.3570138,
            source: "local_dictionary"
        },
        "bhadreswar": {
            name: "Bhadreswar Municipal Hospital, Grand Trunk Road, Chandannagar, Kolkata Metropolitan Area, Singur, Hooghly, West Bengal, 712125, India",
            latitude: 22.8310988,
            longitude: 88.3570138,
            source: "local_dictionary"
        },
        "barasat junction": {
            name: "Barasat Junction, Old Kalibari Road, Champadali, Barasat, Kolkata Metropolitan Area, Barasat - I, North 24 Parganas, West Bengal, 700125, India",
            latitude: 22.7241945,
            longitude: 88.4837829,
            source: "local_dictionary"
        },
        "dum dum": {
            name: "Dum Dum, Kolkata Metropolitan Area, Barrackpur - II, North 24 Parganas, West Bengal, 700081, India",
            latitude: 22.6520597,
            longitude: 88.4360417,
            source: "local_dictionary"
        },
        "brainware university": {
            name: "Brainware University, 398, Barasat - Petrapole Highway, Champadali, Barasat, Kolkata Metropolitan Area, Barasat - I, North 24 Parganas, West Bengal, 700125, India",
            latitude: 22.7317524,
            longitude: 88.4990443,
            source: "local_dictionary"
        }
    };

    if (fallbackLocations[cleanQuery]) {
        return fallbackLocations[cleanQuery];
    }

    // Check campus db
    const campusLoc = await lookupCampusLocation(queryName);
    if (campusLoc) {
        return {
            name: campusLoc.name,
            latitude: campusLoc.latitude,
            longitude: campusLoc.longitude,
            source: "mongodb"
        };
    }

    // Geocode externally
    const extLoc = await geocode(queryName);
    return {
        ...extLoc,
        source: "nominatim"
    };
}

module.exports = {
    haversineDistance,
    lookupCampusLocation,
    geocode,
    reverseGeocode,
    resolveLocation
};
