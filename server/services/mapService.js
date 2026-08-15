const RouteCache = require("../models/RouteCache");
const Location = require("../models/Location");
const locationHelper = require("../utils/locationHelper");
const llmService = require("../ai/services/llmService");
const {filterSafeRoutes} = require("./routeSafetyService");
const settingsService = require("./settingsService");

// Configurable constants for travel cost estimates
const FUEL_PRICE = Number(process.env.FUEL_PRICE || 103.5); // per liter
const CAR_MILEAGE = Number(process.env.CAR_MILEAGE || 14.5); // km per liter
const BIKE_MILEAGE = Number(process.env.BIKE_MILEAGE || 45.0); // km per liter
const TAXI_BASE_FARE = Number(process.env.TAXI_BASE_FARE || 50.0);
const TAXI_PER_KM_RATE = Number(process.env.TAXI_PER_KM_RATE || 15.0);
const PT_BASE_FARE = Number(process.env.PT_BASE_FARE || 10.0);
const PT_PER_KM_RATE = Number(process.env.PT_PER_KM_RATE || 2.5);

// Brainware University main coordinates as default center / fallback
const CAMPUS_DEFAULT_LAT = 22.7212;
const CAMPUS_DEFAULT_LNG = 88.4848;

/**
 * Resolves map and navigation requests from natural language queries
 */
async function resolveLocationRequest({ question, user, userCoordinates, conversationContext }) {
    console.log(`[Map Service] Resolving location request for: "${question}"`);

    let selectedRouteNumber = null;
    const qLower = question.toLowerCase();
    if (/\b(?:first|1st|route\s*1)\b/.test(qLower)) selectedRouteNumber = 1;
    else if (/\b(?:second|2nd|route\s*2)\b/.test(qLower)) selectedRouteNumber = 2;
    else if (/\b(?:third|3rd|route\s*3)\b/.test(qLower)) selectedRouteNumber = 3;

    if (selectedRouteNumber === null && conversationContext && conversationContext.selectedRouteNumber) {
        selectedRouteNumber = conversationContext.selectedRouteNumber;
    }

    // 1. Ask LLM to parse intent parameters
    let parsedParams;
    try {
        const systemPrompt = `You are a precise JSON extractor for a university navigation assistant.
Analyze the user's query and extract the navigation parameters.
Respond with a strict JSON object (no markdown, no other text) with the following structure:
{
  "type": "route" | "nearby" | "unknown",
  "start": "starting location name" | null,
  "destination": "destination location name" | null,
  "nearbyType": "restaurants" | "cafes" | "hospitals" | "medical stores" | "atms" | "bus stops" | "metro stations" | "railway stations" | "hotels" | "pgs" | "hostels" | "parking" | "petrol pumps" | null
}

Guidelines:
- If they ask for distance, route, ETA, travel time, or directions between two points, type is "route".
- If they ask for things nearby, closest, or nearest (e.g. "nearest atm"), type is "nearby" and nearbyType must match one of the options.
- If start location is omitted but implied as current location or "from here", set start to "my location".
- If destination is omitted but implied, set destination. E.g. "how do I reach the admission office?", start is "my location", destination is "admission office".
- Keep location names short (e.g. "Main Gate", "Admission Office", "Library").

Query: "${question}"`;

        const llmResponse = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON parser. Output only valid JSON." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1 });

        const cleanJson = String(llmResponse).replace(/```json/g, "").replace(/```/g, "").trim();
        parsedParams = JSON.parse(cleanJson);
        console.log("[Map Service] LLM Parsed Params:", parsedParams);
    } catch (err) {
        console.error("[Map Service] LLM Parsing failed, using basic heuristic:", err.message);
        parsedParams = parseQueryHeuristically(question);
    }

    // Fallback to conversationContext if LLM returns unknown on a follow-up query
    if (parsedParams.type === "unknown" && conversationContext && conversationContext.routeStart && conversationContext.routeDestination) {
        if (selectedRouteNumber !== null || qLower.includes("how long") || qLower.includes("travel time") || qLower.includes("distance") || qLower.includes("show route") || qLower.includes("show the")) {
            parsedParams.type = "route";
            parsedParams.start = conversationContext.routeStart.name;
            parsedParams.destination = conversationContext.routeDestination.name;
        }
    }

    if (parsedParams.type === "unknown") {
        return {
            found: false,
            answer: "I couldn't identify the specific route, location, or nearby search query in your question. Could you please specify a starting point and destination, or what you are looking for nearby?",
            sources: []
        };
    }

    // Handle Nearby search
    if (parsedParams.type === "nearby") {
        const centerLat = userCoordinates?.lat || CAMPUS_DEFAULT_LAT;
        const centerLng = userCoordinates?.lng || CAMPUS_DEFAULT_LNG;
        const radius = 2000; // 2km radius
        
        try {
            const pois = await findNearbyPlaces(centerLat, centerLng, parsedParams.nearbyType, radius);
            const answer = formatNearbyPoisResponse(pois, parsedParams.nearbyType);
            
            return {
                found: true,
                answer,
                sources: [{ type: "map", title: `OSM Overpass: ${parsedParams.nearbyType}`, reference: "https://overpass-api.de/" }],
                mapData: {
                    type: "nearby",
                    center: { lat: centerLat, lng: centerLng, name: userCoordinates ? "Your Location" : "Campus Center" },
                    nearbyType: parsedParams.nearbyType,
                    places: pois.slice(0, 15)
                }
            };
        } catch (error) {
            console.error("[Map Service] Nearby Search Error:", error);
            return {
                found: false,
                answer: `I encountered an error looking for nearby ${parsedParams.nearbyType}: ${error.message}. Please try again later.`,
                sources: []
            };
        }
    }

    // Handle Routing/Directions
    if (parsedParams.type === "route") {
        let startName = parsedParams.start || "my location";
        let destName = parsedParams.destination || "Brainware University";

        let startCoords = null;
        let destCoords = null;

        const isValidCoordinate = (coords) => {
            return coords && 
                   typeof coords.lat === "number" && isFinite(coords.lat) && 
                   typeof coords.lng === "number" && isFinite(coords.lng);
        };

        // Fallback to conversationContext route start/destination if names match or is a follow-up
        if (conversationContext && 
            isValidCoordinate(conversationContext.routeStart) && 
            isValidCoordinate(conversationContext.routeDestination)) {
            const isContextMatch = (name, contextLoc) => {
                if (!name || !contextLoc) return false;
                const n = name.toLowerCase();
                const cn = String(contextLoc.name || "").toLowerCase();
                return n === cn || n === "my location" || n === "current location" || cn.includes(n) || n.includes(cn);
            };

            if (selectedRouteNumber !== null || qLower.includes("how long") || qLower.includes("travel time") || qLower.includes("distance") ||
                isContextMatch(startName, conversationContext.routeStart) || isContextMatch(destName, conversationContext.routeDestination)) {
                startCoords = conversationContext.routeStart;
                destCoords = conversationContext.routeDestination;
            }
        }

        // Resolve destination coordinates
        if (!destCoords) {
            try {
                const destRes = await locationHelper.resolveLocation(destName);
                destCoords = { lat: destRes.latitude, lng: destRes.longitude, name: destRes.name };
            } catch (err) {
                // Fallback: If destination is the university campus but geocoding fails, use default campus lat/lng
                if (destName.toLowerCase().includes("brainware") || destName.toLowerCase().includes("university") || destName.toLowerCase().includes("campus")) {
                    destCoords = { lat: CAMPUS_DEFAULT_LAT, lng: CAMPUS_DEFAULT_LNG, name: "Brainware University" };
                } else {
                    return {
                        found: false,
                        answer: `I could not resolve the destination "${destName}". Could you please verify the place name?`,
                        sources: []
                    };
                }
            }
        }

        // Resolve start coordinates
        if (!startCoords) {
            if (startName.toLowerCase() === "my location" || startName.toLowerCase() === "current location") {
                if (userCoordinates && userCoordinates.lat && userCoordinates.lng) {
                    startCoords = { lat: userCoordinates.lat, lng: userCoordinates.lng, name: "Your Location" };
                } else {
                    // If coordinates are missing, return a payload requesting geolocation permission
                    return {
                        found: true,
                        requiresLocationPermission: true,
                        answer: "📍 **Location Access Needed**\n\nTo show you accurate routes and directions from your current location, EduMate needs your device's location permission. Please click the button below to allow access, or manually enter your starting location.",
                        sources: [],
                        mapData: {
                            type: "permission_request",
                            destination: destCoords
                        }
                    };
                }
            } else {
                try {
                    const startRes = await locationHelper.resolveLocation(startName);
                    startCoords = { lat: startRes.latitude, lng: startRes.longitude, name: startRes.name };
                } catch (err) {
                    return {
                        found: false,
                        answer: `I could not resolve the starting location "${startName}". Please enter a valid starting point.`,
                        sources: []
                    };
                }
            }
        }


        if (!isValidCoordinate(startCoords)) {
            return {
                found: false,
                answer: `I couldn't find the starting location '${startName}'. Please provide a nearby landmark or a more specific location.`,
                sources: []
            };
        }

        if (!isValidCoordinate(destCoords)) {
            return {
                found: false,
                answer: `I couldn't find the destination '${destName}'. Please provide a nearby landmark or a more specific location.`,
                sources: []
            };
        }

        // Generate or retrieve routes
        try {
            const routes = await calculateAndCacheRoutes(startCoords, destCoords);

            // Apply route selection
            if (selectedRouteNumber !== null) {
                routes.forEach(r => {
                    r.recommended = (r.routeNumber === selectedRouteNumber);
                });
                if (routes.excludedRoutes) {
                    routes.excludedRoutes.forEach(r => {
                        r.recommended = (r.routeNumber === selectedRouteNumber);
                    });
                }
            }

            const naturalAnswer = formatRoutingResponse(startCoords.name, destCoords.name, routes, selectedRouteNumber);

            return {
                found: true,
                answer: naturalAnswer,
                sources: [
                    { type: "map", title: "OpenStreetMap Nominatim Geocoding", reference: "https://nominatim.openstreetmap.org" },
                    { type: "map", title: "OpenRouteService Routing Engine", reference: "https://openrouteservice.org" }
                ],
                mapData: {
                    type: "routing",
                    startLocation: startCoords,
                    destination: destCoords,
                    routes,
                    selectedRouteNumber: selectedRouteNumber || (routes[0] ? routes[0].routeNumber : null)
                }
            };
        } catch (error) {
            console.error("[Map Service] Routing Error:", error);
            let errorMessage = "Unable to calculate the route right now. Please check the location names and try again.";
            if (error.message && error.message.includes("API Key is not configured")) {
                errorMessage = "Map routing is not configured. Please configure the OpenRouteService API key.";
            }
            return {
                found: false,
                answer: errorMessage,
                sources: []
            };
        }
    }

    return {
        found: false,
        answer: "I couldn't understand your map request. Please try phrasing it like: 'How can I reach Main Gate from Admission Office?'",
        sources: []
    };
}

/**
 * Fallback parser using regular expressions if LLM fails
 */
function parseQueryHeuristically(query) {
    const q = query.toLowerCase();
    const routeKeywords = ["route", "directions", "reach", "navigate", "go to", "distance", "how far", "eta"];
    const nearbyKeywords = ["nearby", "near me", "closest", "nearest", "around"];

    const isNearby = nearbyKeywords.some(kw => q.includes(kw));
    const isRoute = routeKeywords.some(kw => q.includes(kw));

    if (isNearby) {
        let matchedType = "restaurants";
        if (q.includes("atm")) matchedType = "atms";
        else if (q.includes("hospital")) matchedType = "hospitals";
        else if (q.includes("cafe")) matchedType = "cafes";
        else if (q.includes("bus")) matchedType = "bus stops";
        else if (q.includes("metro")) matchedType = "metro stations";
        else if (q.includes("hotel")) matchedType = "hotels";
        else if (q.includes("hostel") || q.includes("pg")) matchedType = "hostels";
        else if (q.includes("parking")) matchedType = "parking";
        else if (q.includes("fuel") || q.includes("petrol")) matchedType = "petrol pumps";

        return { type: "nearby", start: "my location", destination: null, nearbyType: matchedType };
    }

    if (isRoute) {
        // Look for pattern "from X to Y" or "to Y from X" or "reach Y"
        let start = "my location";
        let destination = "Brainware University";

        const toMatch = q.match(/(?:reach|go to|directions to|route to)\s+([^from]+)(?:\s+from\s+(.+))?/);
        if (toMatch) {
            destination = toMatch[1].trim();
            if (toMatch[2]) start = toMatch[2].trim();
        } else {
            const fromToMatch = q.match(/from\s+(.+)\s+to\s+(.+)/);
            if (fromToMatch) {
                start = fromToMatch[1].trim();
                destination = fromToMatch[2].trim();
            }
        }
        return { type: "route", start, destination, nearbyType: null };
    }

    return { type: "unknown", start: null, destination: null, nearbyType: null };
}

/**
 * Executes a nearby points of interest query using Overpass OSM API.
 */
async function findNearbyPlaces(lat, lng, type, radiusMeters = 2000) {
    console.log(`[Map Service] Searching Overpass for type: "${type}" near (${lat}, ${lng})`);
    
    // Map internal types to OpenStreetMap amenity/highway tags
    const typeTagMap = {
        "restaurants": 'node["amenity"="restaurant"](around:{{radius}},{{lat}},{{lng}}); way["amenity"="restaurant"](around:{{radius}},{{lat}},{{lng}}); node["amenity"="food_court"](around:{{radius}},{{lat}},{{lng}});',
        "cafes": 'node["amenity"="cafe"](around:{{radius}},{{lat}},{{lng}});',
        "hospitals": 'node["amenity"="hospital"](around:{{radius}},{{lat}},{{lng}}); node["amenity"="clinic"](around:{{radius}},{{lat}},{{lng}});',
        "medical stores": 'node["amenity"="pharmacy"](around:{{radius}},{{lat}},{{lng}});',
        "atms": 'node["amenity"="atm"](around:{{radius}},{{lat}},{{lng}}); node["amenity"="bank"](around:{{radius}},{{lat}},{{lng}});',
        "bus stops": 'node["highway"="bus_stop"](around:{{radius}},{{lat}},{{lng}}); node["amenity"="bus_station"](around:{{radius}},{{lat}},{{lng}});',
        "metro stations": 'node["railway"="subway_entrance"](around:{{radius}},{{lat}},{{lng}}); node["station"="subway"](around:{{radius}},{{lat}},{{lng}});',
        "railway stations": 'node["railway"="station"](around:{{radius}},{{lat}},{{lng}});',
        "hotels": 'node["tourism"="hotel"](around:{{radius}},{{lat}},{{lng}}); node["tourism"="motel"](around:{{radius}},{{lat}},{{lng}});',
        "pgs": 'node["tourism"="hostel"](around:{{radius}},{{lat}},{{lng}}); node["tourism"="guest_house"](around:{{radius}},{{lat}},{{lng}});',
        "hostels": 'node["tourism"="hostel"](around:{{radius}},{{lat}},{{lng}}); node["amenity"="hostel"](around:{{radius}},{{lat}},{{lng}});',
        "parking": 'node["amenity"="parking"](around:{{radius}},{{lat}},{{lng}}); way["amenity"="parking"](around:{{radius}},{{lat}},{{lng}});',
        "petrol pumps": 'node["amenity"="fuel"](around:{{radius}},{{lat}},{{lng}});'
    };

    const searchQL = typeTagMap[type] || typeTagMap["restaurants"];
    const query = `[out:json][timeout:15];
(
  ${searchQL.replace(/{{radius}}/g, radiusMeters).replace(/{{lat}}/g, lat).replace(/{{lng}}/g, lng)}
);
out body;
>;
out skel qt;`;

    const url = "https://overpass-api.de/api/interpreter";
    try {
        const response = await fetch(url, {
            method: "POST",
            body: `data=${encodeURIComponent(query)}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        if (!response.ok) {
            throw new Error(`Overpass API responded with status ${response.status}`);
        }

        const data = await response.json();
        if (!data || !data.elements) return [];

        // Parse features
        const results = [];
        for (const el of data.elements) {
            if (el.type === "node" && el.lat && el.lon) {
                const distance = locationHelper.haversineDistance(lat, lng, el.lat, el.lon);
                results.push({
                    id: el.id,
                    name: el.tags?.name || el.tags?.operator || `${type.charAt(0).toUpperCase() + type.slice(1)} POI`,
                    lat: el.lat,
                    lng: el.lon,
                    distance: parseFloat(distance.toFixed(2)),
                    address: el.tags?.["addr:street"] ? `${el.tags?.["addr:housenumber"] || ""} ${el.tags?.["addr:street"]}` : "Nearby location"
                });
            }
        }

        // Sort by distance ascending
        return results.sort((a, b) => a.distance - b.distance);
    } catch (e) {
        console.error("[Map Service] Overpass Request failed, falling back to mock POIs:", e.message);
        return generateMockPois(lat, lng, type);
    }
}

/**
 * Formats POIs list into a natural markdown list
 */
function formatNearbyPoisResponse(pois, type) {
    if (!pois || pois.length === 0) {
        return `🔍 No nearby **${type}** found within a 2 km radius.`;
    }

    let markdown = `🔍 **Nearby ${type.charAt(0).toUpperCase() + type.slice(1)} (within 2 km)**\n\n`;
    pois.slice(0, 5).forEach((poi, index) => {
        markdown += `${index + 1}. **${poi.name}**\n   📍 Distance: ${poi.distance} km | [Open in Google Maps](https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng})\n`;
    });

    if (pois.length > 5) {
        markdown += `\n*Showing top 5 locations. You can interact with all nearby spots on the map below.*`;
    }

    return markdown;
}

/**
 * Calls OpenRouteService alternatives API for driving-car.
 */
async function fetchOrsRouteAlternatives(start, dest, apiKey) {
    const baseUrl = process.env.OPENROUTE_SERVICE_URL || "https://api.openrouteservice.org";
    const url = `${baseUrl}/v2/directions/driving-car/geojson`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": apiKey
        },
        body: JSON.stringify({
            coordinates: [
                [start.lng, start.lat],
                [dest.lng, dest.lat]
            ],
            alternative_routes: {
                target_count: 3,
                share_factor: 0.8,
                weight_factor: 1.4
            },
            instructions: true
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ORS API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
}

/**
 * Transforms an individual ORS alternative feature to standard route format.
 */
function processOrsFeature(feature, idx, airDistance) {
    const coordinates = feature.geometry.coordinates.map(c => [c[1], c[0]]); // Swap to [lat, lng] for Leaflet
    const properties = feature.properties.segments[0];

    const distanceKm = properties.distance / 1000;
    const durationMin = properties.duration / 60;

    const costDetails = calculateCostForMode("car", distanceKm);
    const costText = costDetails.costRange;

    // Compile turn-by-turn directions
    const instructions = properties.steps.map(step => ({
        text: step.instruction,
        distance: step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`,
        duration: `${Math.round(step.duration / 60)} min`
    }));

    const eta = new Date(Date.now() + properties.duration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
        mode: "car",
        routeNumber: idx + 1,
        label: `Car Route ${idx + 1}`,
        distance: `${distanceKm.toFixed(1)} km`,
        distanceVal: distanceKm,
        time: `${Math.round(durationMin)} min`,
        timeVal: Math.round(durationMin),
        cost: costText,
        advantages: idx === 0 ? "Safest recommended route." : `Alternative car route ${idx + 1}.`,
        eta,
        recommended: false,
        geometry: coordinates,
        instructions
    };
}

/**
 * Calculates, caches, and compiles the three travel options.
 */
async function calculateAndCacheRoutes(start, dest) {
    if (!start || typeof start.lat !== "number" || !isFinite(start.lat) || typeof start.lng !== "number" || !isFinite(start.lng)) {
        throw new Error("Invalid start coordinates provided for routing calculation.");
    }
    if (!dest || typeof dest.lat !== "number" || !isFinite(dest.lat) || typeof dest.lng !== "number" || !isFinite(dest.lng)) {
        throw new Error("Invalid destination coordinates provided for routing calculation.");
    }

    const cacheKeyStart = `${start.lat.toFixed(4)},${start.lng.toFixed(4)}_car_alt`;
    const cacheKeyEnd = `${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}_car_alt`;

    let options = [];

    // ============================================
    // 1. CHECK ROUTE CACHE
    // ============================================
    try {
        const cached = await RouteCache.findOne({
            startKey: cacheKeyStart,
            endKey: cacheKeyEnd
        });

        if (cached && cached.options && cached.options.length > 0) {
            console.log("[Map Service] Serving routes from RouteCache");
            options = cached.options;
        }
    } catch (cacheErr) {
        console.warn("[Map Service] Cache lookup failure:", cacheErr.message);
    }

    // ============================================
    // 2. GENERATE ROUTES IF NOT CACHED
    // ============================================
    if (options.length === 0) {
        const airDistance = locationHelper.haversineDistance(start.lat, start.lng, dest.lat, dest.lng);

        const keysSetting = await settingsService.getApiKeys().catch(() => ({}));
        const rawApiKey = keysSetting.openRouteServiceApiKey || process.env.OPENROUTE_SERVICE_API_KEY;
        const apiKey = (rawApiKey && rawApiKey !== "YOUR_KEY_HERE") ? rawApiKey : null;

        console.log(`[MAP] OpenRouteService API key configured: ${!!apiKey}`);

        if (apiKey) {
            try {
                const geoJson = await fetchOrsRouteAlternatives(start, dest, apiKey);
                if (geoJson && Array.isArray(geoJson.features) && geoJson.features.length > 0) {
                    options = geoJson.features.map((feat, idx) =>
                        processOrsFeature(feat, idx, airDistance)
                    );
                }
            } catch (orsError) {
                console.error("[Map Service] ORS call failed, falling back to mock routes:", orsError.message);
            }
        }

        if (options.length === 0) {
            console.warn("[Map Service] No ORS routes found or error occurred. Falling back to mock routes.");
            options = generateMockRoutes(start, dest, airDistance);
        }

        // ========================================
        // 4. CACHE ORIGINAL ROUTES
        // ========================================
        try {
            await RouteCache.findOneAndUpdate(
                { startKey: cacheKeyStart, endKey: cacheKeyEnd },
                { startKey: cacheKeyStart, endKey: cacheKeyEnd, options },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (saveErr) {
            console.warn("[Map Service] Failed to save RouteCache:", saveErr.message);
        }
    }

    // ============================================
    // 5. ROUTE SAFETY CHECK
    // ============================================
    let safeResult;
    try {
        safeResult = await filterSafeRoutes(options, {
            maxSamplePoints: 20,
            radiusMeters: Number(process.env.ROUTE_SAFETY_RADIUS_METERS || 60)
        });

        console.log(
            `[Route Safety] Checked ${options.length} routes. ` +
            `${safeResult.safeRoutes.length} safe, ` +
            `${safeResult.excludedRoutes.length} excluded.`
        );
    } catch (safetyError) {
        console.warn("[Map Safety] Safety check failed:", safetyError.message);
        safeResult = {
            safeRoutes: options.map(route => ({
                ...route,
                safety: {
                    status: "UNKNOWN",
                    riskLevel: "UNKNOWN",
                    riskScore: null,
                    crimeRisk: { status: "UNAVAILABLE" },
                    physicalHazards: { flood: 0, construction: 0, roadClosure: 0, other: 0 },
                    warnings: ["Route safety information is currently unavailable."]
                }
            })),
            excludedRoutes: [],
            safetyChecked: false
        };
    }

    // Return safeRoutes but attach excludedRoutes as a property on the array
    const routesArray = safeResult.safeRoutes;
    routesArray.excludedRoutes = safeResult.excludedRoutes;
    return routesArray;
}

/**
 * Calls OpenRouteService REST API
 */
async function fetchOrsRoute(start, dest, profile, apiKey) {
    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": apiKey
        },
        body: JSON.stringify({
            coordinates: [
                [start.lng, start.lat],
                [dest.lng, dest.lat]
            ],
            instructions: true
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ORS API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
}

/**
 * Transforms ORS response to internal options format
 */
function processOrsRoute(geoJson, mode, airDistance) {
    const feature = geoJson.features[0];
    const coordinates = feature.geometry.coordinates.map(c => [c[1], c[0]]); // Swap to [lat, lng] for Leaflet
    const properties = feature.properties.segments[0];

    const distanceKm = properties.distance / 1000;
    const durationMin = properties.duration / 60;

    const costDetails = calculateCostForMode(mode, distanceKm);
    const costText = costDetails.costRange;

    // Compile turn-by-turn directions
    const instructions = properties.steps.map(step => ({
        text: step.instruction,
        distance: step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`,
        duration: `${Math.round(step.duration / 60)} min`
    }));

    const eta = new Date(Date.now() + properties.duration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let label = "Car";
    let advantages = "Fast and private route.";
    if (mode === "bike") {
        label = "Bike";
        advantages = "Excellent for beating heavy traffic.";
    } else if (mode === "walking") {
        label = "Walking";
        advantages = "Eco-friendly, zero fuel cost.";
    }

    return {
        mode,
        label,
        distance: `${distanceKm.toFixed(1)} km`,
        distanceVal: distanceKm,
        time: `${Math.round(durationMin)} min`,
        timeVal: Math.round(durationMin),
        cost: costText,
        advantages,
        eta,
        recommended: false,
        geometry: coordinates,
        instructions
    };
}

/**
 * Generates detailed multi-modal public transit steps (trains, buses, Totos, walking)
 */
function generateDetailedTransitSteps(startName, destName, distanceKm, durationMin) {
    const cleanStart = String(startName || "your location").trim();
    const cleanDest = String(destName || "destination").trim();
    
    const walk1 = Math.round(150 + Math.random() * 150); 
    const walk2 = Math.round(100 + Math.random() * 100); 
    
    const steps = [];

    // Step 1: Walk to nearest hub
    steps.push({
        text: `Walk ${walk1} m to the nearest local bus stop or auto-rickshaw stand`,
        distance: `${walk1} m`,
        duration: `${Math.round(walk1 / 80)} min`
    });

    const isAirport = cleanStart.toLowerCase().includes("airport") || cleanStart.toLowerCase().includes("ccu");
    const isHowrah = cleanStart.toLowerCase().includes("howrah");
    const isSealdah = cleanStart.toLowerCase().includes("sealdah");
    const isDumdum = cleanStart.toLowerCase().includes("dum dum") || cleanStart.toLowerCase().includes("dumdum");
    const isBarasat = cleanStart.toLowerCase().includes("barasat") || cleanStart.toLowerCase().includes("champadali");

    if (isAirport) {
        steps.push({
            text: "Board local Bus (Route 253, DN9, or Airport-Barasat Local) from Airport Gate No. 1 towards Barasat",
            distance: "9.2 km",
            duration: "25 min"
        });
        steps.push({
            text: "De-board at Barasat Champadali More crossing",
            distance: "0.1 km",
            duration: "1 min"
        });
        steps.push({
            text: "Walk 150 m to the Barasat auto stand and board a shared Auto-rickshaw / electric Toto towards Hridaypur/Brainware University route",
            distance: "1.8 km",
            duration: "8 min"
        });
    } else if (isHowrah) {
        steps.push({
            text: "Board local bus (Route L238 or Howrah-Barasat express) from Howrah Bus Terminus to Sealdah Station",
            distance: "4.5 km",
            duration: "15 min"
        });
        steps.push({
            text: "Board Sealdah-Hasnabad local train from Sealdah Station Platform 3/4",
            distance: "21.2 km",
            duration: "38 min"
        });
        steps.push({
            text: "De-board train at Hridaypur Suburban Railway Station",
            distance: "0.1 km",
            duration: "1 min"
        });
        steps.push({
            text: "Take a local electric Toto or cycle rickshaw from Hridaypur Station exit directly to Brainware University Main Gate",
            distance: "1.2 km",
            duration: "6 min"
        });
    } else if (isSealdah) {
        steps.push({
            text: "Board Sealdah-Hasnabad or Sealdah-Bangaon Local Train from platform 3/4",
            distance: "22.0 km",
            duration: "35 min"
        });
        steps.push({
            text: "De-board at Hridaypur Railway Station",
            distance: "0.1 km",
            duration: "1 min"
        });
        steps.push({
            text: "Board a local electric Toto / auto-rickshaw from Hridaypur Station directly to Brainware University main entrance",
            distance: "1.2 km",
            duration: "6 min"
        });
    } else if (isBarasat) {
        steps.push({
            text: "Board a shared auto-rickshaw or local Toto from Champadali More crossing towards Hridaypur route",
            distance: "2.2 km",
            duration: "8 min"
        });
    } else {
        const trainDist = (distanceKm * 0.7).toFixed(1);
        const autoDist = (distanceKm * 0.2).toFixed(1);
        const trainTime = Math.round(durationMin * 0.5);
        const autoTime = Math.round(durationMin * 0.3);

        steps.push({
            text: `Board local transit bus or shuttle towards the nearest suburban Railway Station`,
            distance: "1.5 km",
            duration: "6 min"
        });
        steps.push({
            text: `Board suburban Local Train towards Hridaypur / Barasat Junction direction`,
            distance: `${trainDist} km`,
            duration: `${trainTime} min`
        });
        steps.push({
            text: `De-board train at the station and board a shared Auto-rickshaw or local electric Toto toward ${cleanDest}`,
            distance: `${autoDist} km`,
            duration: `${autoTime} min`
        });
    }

    // Final step: Walk inside university / destination
    steps.push({
        text: `Enter main gate and walk ${walk2} m to reach ${cleanDest}`,
        distance: `${walk2} m`,
        duration: `${Math.round(walk2 / 80)} min`
    });

    return steps;
}

/**
 * Creates Option 3 (Public Transit) by modeling bus/walking components over a car route
 */
function generateTransitRouteOption(geoJsonOrCoords, airDistance, start, dest) {
    // Take geometry coordinates
    let coordinates = [];
    if (geoJsonOrCoords.features) {
        coordinates = geoJsonOrCoords.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    } else {
        coordinates = geoJsonOrCoords;
    }

    const distanceKm = airDistance * 1.25;
    const durationMin = distanceKm * 3.5; // Public transport stops + waiting time
    const costDetails = calculateCostForMode("public_transport", distanceKm);

    const eta = new Date(Date.now() + durationMin * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const instructions = generateDetailedTransitSteps(
        start?.name || "your location",
        dest?.name || "Brainware University",
        distanceKm,
        durationMin
    );

    return {
        mode: "public_transport",
        label: "Public Transport",
        distance: `${distanceKm.toFixed(1)} km`,
        distanceVal: distanceKm,
        time: `${Math.round(durationMin)} min`,
        timeVal: Math.round(durationMin),
        cost: costDetails.costRange,
        advantages: "Affordable commuting, avoids driving stress.",
        eta,
        recommended: false,
        geometry: coordinates,
        instructions
    };
}

/**
 * Helper to compute travel cost based on vehicle options
 */
function calculateCostForMode(mode, distanceKm) {
    if (mode === "car") {
        const fuelUsed = distanceKm / CAR_MILEAGE;
        const totalFuelCost = fuelUsed * FUEL_PRICE;
        const minCost = Math.round(totalFuelCost * 0.95);
        const maxCost = Math.round(totalFuelCost * 1.05);
        return {
            costRange: `₹${minCost}–₹${maxCost}`,
            approximate: true
        };
    } else if (mode === "bike") {
        const fuelUsed = distanceKm / BIKE_MILEAGE;
        const totalFuelCost = fuelUsed * FUEL_PRICE;
        const minCost = Math.round(totalFuelCost * 0.9);
        const maxCost = Math.round(totalFuelCost * 1.1);
        return {
            costRange: `₹${minCost}–₹${maxCost}`,
            approximate: true
        };
    } else if (mode === "public_transport") {
        const fare = PT_BASE_FARE + (distanceKm * PT_PER_KM_RATE);
        const minCost = Math.round(fare * 0.85);
        const maxCost = Math.round(fare * 1.15);
        return {
            costRange: `₹${minCost}–₹${maxCost}`,
            approximate: true
        };
    } else if (mode === "taxi") {
        const fare = TAXI_BASE_FARE + (distanceKm * TAXI_PER_KM_RATE);
        const minCost = Math.round(fare * 0.95);
        const maxCost = Math.round(fare * 1.05);
        return {
            costRange: `₹${minCost}–₹${maxCost}`,
            approximate: true
        };
    } else {
        return {
            costRange: "Free",
            approximate: false
        };
    }
}

/**
 * Builds realistic route line bends for visual display without ORS
 */
function simulateRouteGeometry(start, dest) {
    const coords = [];
    const steps = 15;

    for (let i = 0; i <= steps; i++) {
        const fraction = i / steps;
        // Interpolate lat and lng
        let lat = start.lat + (dest.lat - start.lat) * fraction;
        let lng = start.lng + (dest.lng - start.lng) * fraction;

        // Introduce random offsets perpendicular to the path to look like roads
        if (i > 0 && i < steps) {
            const perpOffset = (Math.sin(fraction * Math.PI * 3) + Math.cos(fraction * Math.PI * 2)) * 0.0018;
            lat += perpOffset * (Math.random() > 0.5 ? 1 : -1);
            lng += perpOffset * (Math.random() > 0.5 ? -1 : 1);
        }

        coords.push([lat, lng]);
    }

    return coords;
}

/**
 * Generates route option content from simulated calculations
 */
function generateSimulatedOption(start, dest, mode, airDistance, geometry) {
    const distanceKm = airDistance * 1.25;
    let durationMin;
    let advantages;
    let label;

    if (mode === "car") {
        durationMin = distanceKm * 2.0; // 30 km/h average
        advantages = "Comfortable commute, direct route.";
        label = "Car";
    } else if (mode === "bike") {
        durationMin = distanceKm * 1.8; // Beating traffic, slightly faster avg
        advantages = "Fastest option, bypasses peak-hour congestion.";
        label = "Bike";
    } else if (mode === "walking") {
        durationMin = distanceKm * 12.0; // 5 km/h average
        advantages = "Healthy exercise, zero carbon emissions.";
        label = "Walking";
    } else { // public_transport
        durationMin = distanceKm * 3.2; // 18 km/h average with wait times
        advantages = "Budget-friendly option, avoids parking worries.";
        label = "Public Transport";
    }

    const costDetails = calculateCostForMode(mode, distanceKm);
    const eta = new Date(Date.now() + durationMin * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build simulated instructions
    const instructions = [];
    if (mode === "walking") {
        instructions.push({ text: `Head towards ${dest.name} on walking pathway`, distance: "100 m", duration: "1 min" });
        instructions.push({ text: "Turn right at the main crossing", distance: `${Math.round(distanceKm * 500)} m`, duration: `${Math.round(durationMin / 2)} min` });
        instructions.push({ text: `Arrive at ${dest.name}`, distance: "50 m", duration: "1 min" });
    } else if (mode === "public_transport") {
        const transitSteps = generateDetailedTransitSteps(start.name, dest.name, distanceKm, durationMin);
        instructions.push(...transitSteps);
    } else {
        // Vehicle instruction
        instructions.push({ text: `Start from ${start.name || "starting point"} and drive onto the primary exit road`, distance: "200 m", duration: "1 min" });
        instructions.push({ text: "Merge left onto the main highway / connector road", distance: `${(distanceKm - 1.2).toFixed(1)} km`, duration: `${Math.round(durationMin * 0.7)} min` });
        instructions.push({ text: `Turn right towards the entrance of ${dest.name}`, distance: "1.0 km", duration: "2 min" });
        instructions.push({ text: `Pass campus gate and arrive at ${dest.name}`, distance: "50 m", duration: "1 min" });
    }

    return {
        mode,
        label,
        distance: `${distanceKm.toFixed(1)} km`,
        distanceVal: distanceKm,
        time: `${Math.round(durationMin)} min`,
        timeVal: Math.round(durationMin),
        cost: costDetails.costRange,
        advantages,
        eta,
        recommended: false,
        geometry,
        instructions
    };
}

/**
 * Fallback geometry line builder
 */
function mockGeometry(start, dest) {
    return [
        [start.lat, start.lng],
        [(start.lat + dest.lat) / 2, (start.lng + dest.lng) / 2],
        [dest.lat, dest.lng]
    ];
}

/**
 * Generates mock routes when OpenRouteService is not configured
 */
function generateMockRoutes(start, dest, airDistance) {
    const startLat = start.lat;
    const startLng = start.lng;
    const destLat = dest.lat;
    const destLng = dest.lng;

    // Generate a simple polyline with intermediate points to make it look realistic
    const intermediatePoints = [];
    const stepsCount = 5;
    for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        // Add a slight curve to the line
        const lat = startLat + (destLat - startLat) * t + Math.sin(t * Math.PI) * 0.002;
        const lng = startLng + (destLng - startLng) * t + Math.cos(t * Math.PI) * 0.002;
        intermediatePoints.push([lat, lng]);
    }

    const distanceKm = airDistance * 1.25 || 1.5;
    const durationMin = distanceKm * 3.5 || 5;

    const carRoute = {
        mode: "car",
        routeNumber: 1,
        label: "Primary Car Route (Mock)",
        distance: `${distanceKm.toFixed(1)} km`,
        distanceVal: distanceKm,
        time: `${Math.round(durationMin)} min`,
        timeVal: Math.round(durationMin),
        cost: `Rs. ${Math.round(distanceKm * 8)}`,
        advantages: "Recommended safest route.",
        eta: new Date(Date.now() + durationMin * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommended: true,
        geometry: intermediatePoints,
        instructions: [
            { text: `Head out from starting point: ${start.name || "Start Location"}`, distance: "100 m", duration: "1 min" },
            { text: "Turn right onto the main link road", distance: `${(distanceKm * 0.4).toFixed(1)} km`, duration: `${Math.round(durationMin * 0.4)} min` },
            { text: "Keep straight through the campus gateway intersection", distance: `${(distanceKm * 0.5).toFixed(1)} km`, duration: `${Math.round(durationMin * 0.5)} min` },
            { text: `Arrive at destination: ${dest.name || "Destination"}`, distance: "0 m", duration: "0 min" }
        ]
    };

    const bikeRoute = {
        mode: "bike",
        routeNumber: 2,
        label: "Alternative Bike Route (Mock)",
        distance: `${(distanceKm * 0.95).toFixed(1)} km`,
        distanceVal: distanceKm * 0.95,
        time: `${Math.round(durationMin * 0.8)} min`,
        timeVal: Math.round(durationMin * 0.8),
        cost: `Rs. ${Math.round(distanceKm * 3)}`,
        advantages: "Faster in heavy traffic.",
        eta: new Date(Date.now() + durationMin * 0.8 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommended: false,
        geometry: intermediatePoints,
        instructions: [
            { text: `Depart from starting point: ${start.name || "Start Location"}`, distance: "50 m", duration: "1 min" },
            { text: "Take the narrow lane shortcut", distance: `${(distanceKm * 0.9).toFixed(1)} km`, duration: `${Math.round(durationMin * 0.7)} min` },
            { text: `Arrive at destination: ${dest.name || "Destination"}`, distance: "0 m", duration: "0 min" }
        ]
    };

    // Third route that will be simulated as high-risk and excluded
    const transitRoute = {
        mode: "car",
        routeNumber: 3,
        label: "Risky Bypass Route (Mock)",
        distance: `${(distanceKm * 1.3).toFixed(1)} km`,
        distanceVal: distanceKm * 1.3,
        time: `${Math.round(durationMin * 1.2)} min`,
        timeVal: Math.round(durationMin * 1.2),
        cost: `Rs. ${Math.round(distanceKm * 10)}`,
        advantages: "Bypasses standard entry routes.",
        eta: new Date(Date.now() + durationMin * 1.2 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommended: false,
        geometry: intermediatePoints,
        instructions: [
            { text: `Depart from starting point: ${start.name || "Start Location"}`, distance: "100 m", duration: "1 min" },
            { text: "Proceed along the outer boundary bypass", distance: `${(distanceKm * 1.2).toFixed(1)} km`, duration: `${Math.round(durationMin * 1.1)} min` },
            { text: `Arrive at destination: ${dest.name || "Destination"}`, distance: "0 m", duration: "0 min" }
        ]
    };

    return [carRoute, bikeRoute, transitRoute];
}

/**
 * Fallback OSM mock points if Overpass is down
 */
function generateMockPois(lat, lng, type) {
    const list = [
        { name: "Saffron Spices Restaurant", lat: lat + 0.003, lng: lng - 0.002, offset: 0.0036 },
        { name: "Urban Cafe & Hub", lat: lat - 0.002, lng: lng + 0.004, offset: 0.0044 },
        { name: "Sanjeevani Hospital", lat: lat + 0.007, lng: lng + 0.001, offset: 0.0071 },
        { name: "City Center Pharmacy", lat: lat + 0.001, lng: lng - 0.004, offset: 0.0041 },
        { name: "SBI ATM Branch", lat: lat - 0.001, lng: lng - 0.001, offset: 0.0014 },
        { name: "University Bus Stand", lat: lat - 0.005, lng: lng + 0.002, offset: 0.0053 }
    ];

    return list.map((item, index) => {
        const dist = locationHelper.haversineDistance(lat, lng, item.lat, item.lng);
        return {
            id: 900000 + index,
            name: item.name,
            lat: item.lat,
            lng: item.lng,
            distance: parseFloat(dist.toFixed(2)),
            address: "Kolkata Road, Barasat"
        };
    }).filter(i => {
        // filter or rank based on keyword matching
        const n = i.name.toLowerCase();
        if (type === "restaurants" && n.includes("rest")) return true;
        if (type === "cafes" && n.includes("cafe")) return true;
        if (type === "hospitals" && n.includes("hosp")) return true;
        if (type === "medical stores" && n.includes("pharm")) return true;
        if (type === "atms" && n.includes("atm")) return true;
        if (type === "bus stops" && n.includes("bus")) return true;
        return true; // fallback
    });
}

/**
 * Formats routing travel options to clean natural text output
 */
function formatRoutingResponse(startName, destinationName, options, selectedRouteNumber = null) {
    const recommendedRoute = options.find(r => r.recommended) || options[0];
    if (!recommendedRoute) {
        return "No routes currently available.";
    }

    const headerWording = (recommendedRoute.safety && recommendedRoute.safety.riskLevel === "LOW")
        ? "Safest currently available route"
        : "Lower-risk route based on available current data";

    let md = `🛣️ Route Recommendation\n\n`;
    md += `${headerWording}:\n`;
    md += `${startName} → ${destinationName}\n\n`;

    md += `${recommendedRoute.label || `Route ${recommendedRoute.routeNumber}`}\n`;
    md += `Distance: ${recommendedRoute.distance}\n`;
    md += `Estimated time: ${recommendedRoute.time}\n\n`;

    md += `Safety:\n`;
    const safety = recommendedRoute.safety;
    if (!safety || safety.status === "UNKNOWN" || safety.riskLevel === "UNKNOWN") {
        md += `Safety verification is currently unavailable for this route.\n\n`;
    } else {
        if (safety.physicalHazards?.flood > 0) {
            md += `✗ Flood hazard detected along this route\n`;
        } else {
            md += `✓ No reported flood hazard\n`;
        }
        if (safety.physicalHazards?.roadClosure > 0) {
            md += `✗ Road closure detected along this route\n`;
        } else {
            md += `✓ No mapped road closure\n`;
        }
        if (safety.crimeRisk?.status !== "AVAILABLE") {
            md += `Safety verification is currently unavailable for this route.\n`;
        } else {
            const riskLvl = safety.crimeRisk.score >= 75 ? "High" : safety.crimeRisk.score >= 35 ? "Moderate" : "Low";
            md += `✓ ${riskLvl} recent incident risk\n`;
        }
        md += `\n`;
    }

    md += `Why recommended:\n`;
    if (recommendedRoute.routeNumber === options[0]?.routeNumber && (!safety || safety.status !== "UNKNOWN")) {
        md += `This route has the lowest safety risk among the available routes.\n\n`;
    } else if (selectedRouteNumber !== null) {
        md += `This is the user-selected route (Route ${recommendedRoute.routeNumber}).\n\n`;
    } else {
        md += `This route is recommended based on currently available safety data.\n\n`;
    }

    md += `Alternative routes:\n`;
    let alternativesExist = false;

    let allRoutes = [...options];
    if (options.excludedRoutes) {
        allRoutes = allRoutes.concat(options.excludedRoutes);
    }

    allRoutes.forEach(r => {
        if (r.routeNumber !== recommendedRoute.routeNumber) {
            alternativesExist = true;
            const riskLabel = r.safety?.status === "UNKNOWN"
                ? "Safety verification unavailable"
                : r.safety?.riskLevel === "LOW" ? "Low risk"
                : r.safety?.riskLevel === "MEDIUM" ? "Moderate risk"
                : r.safety?.riskLevel === "HIGH" ? "Higher risk"
                : r.safety?.riskLevel === "EXCLUDED" ? "Higher risk (Excluded)"
                : "Higher risk";
            md += `${r.label || `Route ${r.routeNumber}`} — ${r.time} — ${riskLabel}\n`;
        }
    });

    if (!alternativesExist) {
        md += `No alternative routes found.\n`;
    }

    md += `\n[Show Route]`;
    return md;
}

module.exports = {
    resolveLocationRequest,
    calculateAndCacheRoutes,
    findNearbyPlaces
};
