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

    // Map academic blocks and building terms to campus database nodes
    if (cleanName.includes("block 1") || cleanName.includes("building 1") || cleanName.includes("building i") || cleanName.includes("satyajit")) {
        cleanName = "Academic Block 1";
    } else if (cleanName.includes("block 2") || cleanName.includes("building 2") || cleanName.includes("building ii") || cleanName.includes("vidyasagar")) {
        cleanName = "Academic Block 2";
    } else if (cleanName.includes("block 3") || cleanName.includes("building 3") || cleanName.includes("building iii") || cleanName.includes("prafulla")) {
        cleanName = "Academic Block 3";
    } else if (cleanName.includes("block 4") || cleanName.includes("building 4") || cleanName.includes("building iv") || cleanName.includes("jagdish")) {
        cleanName = "Academic Block 4";
    } else if (cleanName.includes("block 5") || cleanName.includes("building 5") || cleanName.includes("building v") || cleanName.includes("ravindra")) {
        cleanName = "Academic Block 5";
    } else if (cleanName.includes("block 6") || cleanName.includes("building 6") || cleanName.includes("building vi") || cleanName.includes("rammohan")) {
        cleanName = "Academic Block 6";
    } else if (cleanName.includes("block 7") || cleanName.includes("building 7") || cleanName.includes("building vii") || cleanName.includes("aurobindo")) {
        cleanName = "Academic Block 7";
    } else if (cleanName.includes("block 8") || cleanName.includes("building 8") || cleanName.includes("building viii") || cleanName.includes("satyendra")) {
        cleanName = "Academic Block 8";
    } else if (cleanName.includes("block 9") || cleanName.includes("building 9") || cleanName.includes("building ix") || cleanName.includes("vivekananda")) {
        cleanName = "Academic Block 9";
    } else if (cleanName.includes("library")) {
        cleanName = "library";
    } else if (cleanName.includes("examination")) {
        cleanName = "examination cell";
    } else if (cleanName.includes("accounts")) {
        cleanName = "accounts office";
    } else if (cleanName.includes("admission")) {
        cleanName = "admission office";
    } else if (cleanName.includes("canteen")) {
        cleanName = "canteen";
    } else if (cleanName.includes("hostel")) {
        cleanName = "hostel";
    } else if (cleanName.includes("building") || cleanName.includes("bhavan") || cleanName.includes("bhawan") || cleanName.includes("block")) {
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
        },
        "academic block 1": { name: "Academic Block 1 (Building I - Satyajit Bhavan)", latitude: 22.7205, longitude: 88.4852, source: "campus_map" },
        "academic block 2": { name: "Academic Block 2 (Building II - Vidyasagar Bhavan)", latitude: 22.7208, longitude: 88.4853, source: "campus_map" },
        "academic block 3": { name: "Academic Block 3 (Building III - Prafulla Bhavan)", latitude: 22.7211, longitude: 88.4855, source: "campus_map" },
        "academic block 4": { name: "Academic Block 4 (Building IV - Jagdish Bhavan)", latitude: 22.7210, longitude: 88.4848, source: "campus_map" },
        "academic block 5": { name: "Academic Block 5 (Building V - Ravindra Bhavan)", latitude: 22.7212, longitude: 88.4853, source: "campus_map" },
        "academic block 6": { name: "Academic Block 6 (Building VI - Rammohan Bhavan)", latitude: 22.7214, longitude: 88.4851, source: "campus_map" },
        "academic block 7": { name: "Academic Block 7 (Building VII - Aurobindo Bhavan)", latitude: 22.7215, longitude: 88.4855, source: "campus_map" },
        "academic block 8": { name: "Academic Block 8 (Building VIII - Satyendra Bhavan)", latitude: 22.7216, longitude: 88.4852, source: "campus_map" },
        "academic block 9": { name: "Academic Block 9 (Building IX - Vivekananda Bhavan)", latitude: 22.7218, longitude: 88.4858, source: "campus_map" },
        "building 1": { name: "Academic Block 1 (Building I - Satyajit Bhavan)", latitude: 22.7205, longitude: 88.4852, source: "campus_map" },
        "building 2": { name: "Academic Block 2 (Building II - Vidyasagar Bhavan)", latitude: 22.7208, longitude: 88.4853, source: "campus_map" },
        "building 3": { name: "Academic Block 3 (Building III - Prafulla Bhavan)", latitude: 22.7211, longitude: 88.4855, source: "campus_map" },
        "building 4": { name: "Academic Block 4 (Building IV - Jagdish Bhavan)", latitude: 22.7210, longitude: 88.4848, source: "campus_map" },
        "building 5": { name: "Academic Block 5 (Building V - Ravindra Bhavan)", latitude: 22.7212, longitude: 88.4853, source: "campus_map" },
        "building 6": { name: "Academic Block 6 (Building VI - Rammohan Bhavan)", latitude: 22.7214, longitude: 88.4851, source: "campus_map" },
        "building 7": { name: "Academic Block 7 (Building VII - Aurobindo Bhavan)", latitude: 22.7215, longitude: 88.4855, source: "campus_map" },
        "building 8": { name: "Academic Block 8 (Building VIII - Satyendra Bhavan)", latitude: 22.7216, longitude: 88.4852, source: "campus_map" },
        "building 9": { name: "Academic Block 9 (Building IX - Vivekananda Bhavan)", latitude: 22.7218, longitude: 88.4858, source: "campus_map" }
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
