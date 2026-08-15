const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

const DEFAULT_RADIUS_METERS = Number(process.env.ROUTE_SAFETY_RADIUS_METERS || 60);

const crimeRiskService = require("./crimeRiskService");
const locationHelper = require("../utils/locationHelper");

// In-memory cache for physical hazard coordinate points
const physicalHazardCache = new Map();

/**
 * Sample route coordinates so we don't make an API request
 * for every single point in the route.
 */
function sampleRoute(route, maxPoints = 20) {
    if (!Array.isArray(route?.geometry) || route.geometry.length === 0) {
        return [];
    }

    const geometry = route.geometry;
    if (geometry.length <= maxPoints) {
        return geometry;
    }

    const points = [];
    for (let i = 0; i < maxPoints; i++) {
        const index = Math.round((i * (geometry.length - 1)) / (maxPoints - 1));
        points.push(geometry[index]);
    }
    return points;
}

/**
 * Remove duplicate nearby points.
 */
function uniquePoints(points) {
    const seen = new Set();
    return points.filter(([lat, lng]) => {
        const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Batched OSM/Overpass query for hazards around multiple points.
 */
async function queryHazardsBatch(coordinates, radius) {
    if (coordinates.length === 0) {
        return [];
    }

    let aroundStatements = "";
    for (const [lat, lng] of coordinates) {
        aroundStatements += `
            way(around:${radius},${lat},${lng})["highway"="construction"];
            way(around:${radius},${lat},${lng})["construction"];
            way(around:${radius},${lat},${lng})["access"="no"];
            way(around:${radius},${lat},${lng})["vehicle"="no"];
            way(around:${radius},${lat},${lng})["motor_vehicle"="no"];
            way(around:${radius},${lat},${lng})["flood_prone"];
            way(around:${radius},${lat},${lng})["hazard"];
            node(around:${radius},${lat},${lng})["flood_prone"];
            node(around:${radius},${lat},${lng})["hazard"];
        `;
    }

    const query = `[out:json][timeout:25];
    (
        ${aroundStatements}
    );
    out tags center;`;

    console.log(`[Physical Hazard] Running batched Overpass query for ${coordinates.length} points.`);
    const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "EduMate-AI/1.0"
        },
        body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
        throw new Error(`Overpass API returned status code ${response.status}`);
    }

    const data = await response.json();
    return data?.elements || [];
}

/**
 * Classify raw Overpass elements.
 */
function classifyHazards(elements) {
    const result = {
        flood: [],
        construction: [],
        roadClosure: [],
        other: []
    };

    for (const element of elements || []) {
        const tags = element.tags || {};

        if (tags.flood_prone === "yes" || tags.hazard === "flood" || tags.hazard === "flooding") {
            result.flood.push({ type: "flood", tags });
        }
        if (tags.highway === "construction" || tags.construction) {
            result.construction.push({ type: "construction", tags });
        }
        if (tags.access === "no" || tags.vehicle === "no" || tags.motor_vehicle === "no") {
            result.roadClosure.push({ type: "road_closure", tags });
        }
        if (tags.hazard && tags.hazard !== "flood" && tags.hazard !== "flooding") {
            result.other.push({ type: tags.hazard, tags });
        }
    }

    return result;
}

/**
 * Evaluate single route safety.
 */
async function evaluateRoute(route, options = {}) {
    const maxSamplePoints = options.maxSamplePoints || 20;
    const radiusMeters = options.radiusMeters || DEFAULT_RADIUS_METERS;

    const points = uniquePoints(sampleRoute(route, maxSamplePoints));

    const safety = {
        status: "SAFE",
        riskLevel: "LOW",
        riskScore: 0,
        crimeRisk: {
            status: "UNAVAILABLE",
            score: null,
            incidentCount: null,
            weightedIncidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0
        },
        physicalHazards: {
            flood: 0,
            construction: 0,
            roadClosure: 0,
            other: 0
        },
        warnings: [],
        reasons: [],
        checkedAt: new Date().toISOString()
    };

    if (points.length === 0) {
        safety.status = "UNKNOWN";
        safety.riskLevel = "UNKNOWN";
        safety.riskScore = null;
        safety.warnings.push("Route safety could not be checked because route geometry is unavailable.");
        return safety;
    }

    // ==================================================
    // 1. PHYSICAL HAZARDS (BATCHED & CACHED)
    // ==================================================
    let physicalHazardsList = {
        flood: [],
        construction: [],
        roadClosure: [],
        other: []
    };

    const cacheTTL = (Number(process.env.ROUTE_SAFETY_CACHE_TTL_SECONDS) || 300) * 1000;
    const now = Date.now();

    const coordinatesToQuery = [];
    const cachedResults = [];

    for (const [lat, lng] of points) {
        const latKey = Number(lat).toFixed(4);
        const lngKey = Number(lng).toFixed(4);
        const cacheKey = `${latKey},${lngKey}`;

        if (physicalHazardCache.has(cacheKey)) {
            const cached = physicalHazardCache.get(cacheKey);
            if (now - cached.timestamp < cacheTTL) {
                cachedResults.push(cached.hazards);
                continue;
            }
        }
        coordinatesToQuery.push([lat, lng]);
    }

    let queryFailed = false;
    let freshElements = [];

    if (coordinatesToQuery.length > 0) {
        try {
            freshElements = await queryHazardsBatch(coordinatesToQuery, radiusMeters);
        } catch (error) {
            console.error("[Physical Hazard] Overpass batch query failed:", error.message);
            queryFailed = true;
            safety.warnings.push("Physical hazard information could not be verified.");
        }
    }

    if (!queryFailed) {
        // Associate freshElements with coordinate points and cache them
        for (const [lat, lng] of coordinatesToQuery) {
            const latKey = Number(lat).toFixed(4);
            const lngKey = Number(lng).toFixed(4);
            const cacheKey = `${latKey},${lngKey}`;

            // Filter elements within radius of this specific coordinate point
            const nearbyElements = freshElements.filter(el => {
                const elLat = el.lat || el.center?.lat;
                const elLng = el.lon || el.center?.lon;
                if (!elLat || !elLng) return false;

                const distKm = locationHelper.haversineDistance(lat, lng, elLat, elLng);
                return (distKm * 1000) <= radiusMeters;
            });

            const pointHazards = classifyHazards(nearbyElements);
            physicalHazardCache.set(cacheKey, {
                hazards: pointHazards,
                timestamp: now
            });
            cachedResults.push(pointHazards);
        }

        // Aggregate physical hazard counts
        const floodSet = new Set();
        const constructionSet = new Set();
        const roadClosureSet = new Set();
        const otherSet = new Set();

        for (const res of cachedResults) {
            res.flood.forEach(h => floodSet.add(JSON.stringify(h.tags)));
            res.construction.forEach(h => constructionSet.add(JSON.stringify(h.tags)));
            res.roadClosure.forEach(h => roadClosureSet.add(JSON.stringify(h.tags)));
            res.other.forEach(h => otherSet.add(JSON.stringify(h.tags)));
        }

        safety.physicalHazards = {
            flood: floodSet.size,
            construction: constructionSet.size,
            roadClosure: roadClosureSet.size,
            other: otherSet.size
        };
    } else {
        // Physical hazard provider failed
        safety.status = "UNKNOWN";
        safety.riskLevel = "UNKNOWN";
        safety.riskScore = null;
    }

    // ==================================================
    // 2. CRIME / INCIDENT RISK
    // ==================================================
    let crimeRisk = null;
    try {
        crimeRisk = await crimeRiskService.getCrimeRiskForRoute(route, {
            maxSamplePoints,
            radiusMeters: Number(process.env.CRIME_DATA_RADIUS_METERS || 150)
        });
        safety.crimeRisk = crimeRisk;
    } catch (crimeError) {
        console.error("[Crime Risk] Crime risk check failed:", crimeError.message);
        safety.warnings.push("Crime incident data could not be verified.");
        safety.crimeRisk = {
            status: "UNKNOWN",
            score: null,
            incidentCount: null,
            weightedIncidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0
        };
    }

    // If critical safety check (physical hazard query or crime data query) is unknown/fails
    if (queryFailed || safety.crimeRisk.status === "UNKNOWN") {
        safety.status = "UNKNOWN";
        safety.riskLevel = "UNKNOWN";
        safety.riskScore = null;
        return safety;
    }

    // ==================================================
    // 3. SCORE & RATING CALCULATION
    // ==================================================
    // Calculate physical risk score (capped at 100)
    let physicalRiskScore = 0;
    if (safety.physicalHazards.flood > 0) {
        physicalRiskScore = 100;
        safety.warnings.push("Flood hazard detected along this route.");
    } else if (safety.physicalHazards.roadClosure > 0) {
        physicalRiskScore = 100;
        safety.warnings.push("Road closure detected along this route.");
    } else {
        if (safety.physicalHazards.construction > 0) {
            physicalRiskScore += 30;
            safety.warnings.push("Road construction detected along this route.");
        }
        if (safety.physicalHazards.other > 0) {
            physicalRiskScore += 15;
            safety.warnings.push("Other road hazard detected along this route.");
        }
        physicalRiskScore = Math.min(physicalRiskScore, 100);
    }

    // Calculate crime risk score
    let crimeRiskScore = 0;
    const isCrimeAvailable = safety.crimeRisk.status === "AVAILABLE";
    if (isCrimeAvailable) {
        crimeRiskScore = safety.crimeRisk.score || 0;
        if (safety.crimeRisk.warnings && safety.crimeRisk.warnings.length > 0) {
            safety.warnings.push(...safety.crimeRisk.warnings);
        }
    }

    // Compute composite safety score
    const physicalWeight = Number(process.env.PHYSICAL_RISK_WEIGHT || 0.45);
    const crimeWeight = Number(process.env.CRIME_RISK_WEIGHT || 0.55);

    let overallRiskScore = 0;
    if (isCrimeAvailable) {
        overallRiskScore = (physicalRiskScore * physicalWeight) + (crimeRiskScore * crimeWeight);
    } else {
        // If crime data is unavailable (disabled/unconfigured)
        overallRiskScore = physicalRiskScore;
        safety.warnings.push("Crime data unavailable");
    }
    safety.riskScore = Math.round(overallRiskScore);

    // ==================================================
    // 4. HARD EXCLUSION RULES
    // ==================================================
    const crimeHardExclusion = Number(process.env.CRIME_HARD_EXCLUSION_SCORE || 75);
    const crimeHotspotExclusion = Number(process.env.CRIME_HOTSPOT_EXCLUSION_SCORE || 85);
    const requireCrimeData = process.env.REQUIRE_CRIME_DATA_FOR_SAFE_ROUTE === "true";

    let isExcluded = false;

    if (safety.physicalHazards.roadClosure > 0) {
        isExcluded = true;
        safety.reasons.push("Road closure detected");
    }
    if (safety.physicalHazards.flood > 0) {
        isExcluded = true;
        safety.reasons.push("Flood hazard detected");
    }

    // Only trigger road-level crime exclusions if source granularity is POINT-level
    const isPointGranularity = safety.crimeRisk.granularity === "point";

    if (isCrimeAvailable && isPointGranularity) {
        if (crimeRiskScore >= crimeHardExclusion) {
            isExcluded = true;
            safety.reasons.push("Elevated recent crime incident risk");
        }
        // Check for verified high-severity hotspot cluster exclusions
        if (Array.isArray(safety.crimeRisk.hotspots)) {
            const hasExclusionHotspot = safety.crimeRisk.hotspots.some(h => h.score >= crimeHotspotExclusion);
            if (hasExclusionHotspot) {
                isExcluded = true;
                safety.reasons.push("Route passes through a critical incident hotspot");
            }
        }
    }

    // If required crime data is unavailable
    if (!isCrimeAvailable && requireCrimeData) {
        isExcluded = true;
        safety.reasons.push("Safety verification unavailable");
    }

    // If source granularity is district, add note rather than road-level crime alerts
    if (isCrimeAvailable && safety.crimeRisk.granularity === "district") {
        safety.warnings.push("District-level crime data indicates elevated background risk.");
    }

    if (isExcluded) {
        safety.status = "EXCLUDED";
        safety.riskLevel = "EXCLUDED";
    } else {
        // Update risk levels
        if (!isCrimeAvailable) {
            safety.status = "UNKNOWN";
            safety.riskLevel = "UNKNOWN";
        } else if (safety.riskScore >= 75) {
            safety.riskLevel = "HIGH";
        } else if (safety.riskScore >= 35) {
            safety.riskLevel = "MEDIUM";
        } else {
            safety.riskLevel = "LOW";
        }
    }

    return safety;
}

/**
 * Evaluate all routes. Filter/rank them.
 */
async function filterSafeRoutes(routes, options = {}) {
    if (!Array.isArray(routes)) {
        return {
            safeRoutes: [],
            excludedRoutes: [],
            safetyChecked: false
        };
    }

    const safeRoutes = [];
    const excludedRoutes = [];

    const requireCrimeData = process.env.REQUIRE_CRIME_DATA_FOR_SAFE_ROUTE === "true";

    for (const route of routes) {
        if (!route.geometry || route.geometry.length === 0) {
            // Reject route with no geometry
            continue;
        }

        const safety = await evaluateRoute(route, options);
        const routeWithSafety = {
            ...route,
            safety
        };

        if (safety.status === "EXCLUDED") {
            excludedRoutes.push({
                routeNumber: route.routeNumber || 1,
                label: route.label || "Route",
                reason: safety.reasons.join(", ") || "Elevated safety risk",
                geometry: route.geometry,
                time: route.time,
                distance: route.distance
            });
        } else if (safety.status === "UNKNOWN" && requireCrimeData) {
            // Exclude unknown routes when crime data is strictly required
            excludedRoutes.push({
                routeNumber: route.routeNumber || 1,
                label: route.label || "Route",
                reason: "Safety verification unavailable",
                geometry: route.geometry,
                time: route.time,
                distance: route.distance
            });
        } else {
            safeRoutes.push(routeWithSafety);
        }
    }

    // Sort by safety score first, then travel time, then distance
    safeRoutes.sort((a, b) => {
        // If one is UNKNOWN and one is SAFE
        const aScore = a.safety.status === "UNKNOWN" ? 999 : (a.safety.riskScore || 0);
        const bScore = b.safety.status === "UNKNOWN" ? 999 : (b.safety.riskScore || 0);

        if (aScore !== bScore) {
            return aScore - bScore;
        }

        // Compare time
        const aTime = a.timeVal || 0;
        const bTime = b.timeVal || 0;
        if (aTime !== bTime) {
            return aTime - bTime;
        }

        // Compare distance
        const aDist = a.distanceVal || 0;
        const bDist = b.distanceVal || 0;
        return aDist - bDist;
    });

    // Reset recommended recommendation
    safeRoutes.forEach(r => {
        r.recommended = false;
    });

    if (safeRoutes.length > 0) {
        safeRoutes[0].recommended = true;
    }

    return {
        safeRoutes,
        excludedRoutes,
        safetyChecked: true
    };
}

module.exports = {
    evaluateRoute,
    filterSafeRoutes
};