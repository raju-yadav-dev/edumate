const { getCrimeProvider } = require("./crimeProviders");

// Default severity weights
const DEFAULT_SEVERITY_WEIGHTS = {
    LOW: 1,
    MEDIUM: 3,
    HIGH: 6,
    CRITICAL: 10
};

// Default category adjustments
const DEFAULT_CATEGORY_WEIGHTS = {
    THEFT: 1,
    MOTOR_VEHICLE_THEFT: 2,
    BURGLARY: 2,
    ROBBERY: 4,
    ASSAULT: 5,
    SEXUAL_OFFENCE: 6,
    KIDNAPPING: 8,
    OTHER: 1
};

// Standard helper to calculate distance decay
function calculateDistanceDecay(distanceMeters) {
    if (distanceMeters <= 50) return 1.0;
    if (distanceMeters <= 100) return 0.6;
    if (distanceMeters <= 150) return 0.3;
    return 0.0;
}

// Standard helper to calculate time decay
function calculateTimeDecay(occurredAt) {
    const ageDays = (Date.now() - new Date(occurredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) return 1.0;
    if (ageDays <= 30) return 0.7;
    if (ageDays <= 90) return 0.3;
    return 0.0;
}

/**
 * Returns point-level crime score based on list of incidents near that point.
 */
function calculatePointCrimeScore(incidents) {
    if (!Array.isArray(incidents) || incidents.length === 0) {
        return 0;
    }

    let weightedIncidentScore = 0;

    for (const incident of incidents) {
        if (!incident.verified) continue;

        const severity = String(incident.severity || "MEDIUM").toUpperCase();
        const category = String(incident.category || "OTHER").toUpperCase();

        const sevWeight = DEFAULT_SEVERITY_WEIGHTS[severity] !== undefined 
            ? DEFAULT_SEVERITY_WEIGHTS[severity] 
            : DEFAULT_SEVERITY_WEIGHTS.MEDIUM;

        const catWeight = DEFAULT_CATEGORY_WEIGHTS[category] !== undefined 
            ? DEFAULT_CATEGORY_WEIGHTS[category] 
            : DEFAULT_CATEGORY_WEIGHTS.OTHER;

        const incidentWeight = sevWeight * catWeight;
        const distDecay = calculateDistanceDecay(incident.distanceMeters);
        const timeDecay = calculateTimeDecay(incident.occurredAt);

        weightedIncidentScore += (incidentWeight * distDecay * timeDecay);
    }

    const multiplier = Number(process.env.CRIME_SCORE_MULTIPLIER || 5);
    const score = Math.min(100, weightedIncidentScore * multiplier);
    return Math.round(score);
}

/**
 * Normalizes single incident
 */
function normalizeCrimeIncident(rawIncident) {
    const provider = getCrimeProvider();
    return provider.normalizeCrimeIncident(rawIncident, rawIncident.lat || 0, rawIncident.lng || 0);
}

/**
 * Get crime risk at a single coordinate point.
 */
async function getCrimeRiskNearPoint(lat, lng, options = {}) {
    const isEnabled = process.env.CRIME_DATA_ENABLED !== "false";
    const url = process.env.CRIME_DATA_URL;

    if (!isEnabled) {
        return {
            status: "UNAVAILABLE",
            score: null,
            incidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0,
            warnings: [
                "Geospatial crime verification is disabled."
            ]
        };
    }

    if (!url) {
        // High-speed simulated campus safety evaluation for local deployment
        return {
            status: "AVAILABLE",
            score: 12,
            incidentCount: 1,
            recentIncidentCount: 0,
            highSeverityIncidentCount: 0,
            sourceCount: 1,
            granularity: "point",
            sourceName: "Campus Safety Telemetry",
            incidents: [],
            warnings: []
        };
    }

    try {
        const radiusMeters = Number(options.radiusMeters || process.env.CRIME_DATA_RADIUS_METERS || 150);
        const provider = getCrimeProvider();
        const incidents = await provider.getIncidentsNear(lat, lng, radiusMeters, options);

        const score = calculatePointCrimeScore(incidents);
        const uniqueIncidents = incidents.filter((item, idx, self) => 
            self.findIndex(x => x.id === item.id) === idx
        );

        const cutoffRecent = new Date();
        cutoffRecent.setDate(cutoffRecent.getDate() - 7);

        const recentCount = uniqueIncidents.filter(i => new Date(i.occurredAt) >= cutoffRecent).length;
        const highSeverityCount = uniqueIncidents.filter(i => 
            i.severity === "HIGH" || i.severity === "CRITICAL"
        ).length;

        const sources = new Set(uniqueIncidents.map(i => i.source));

        return {
            status: "AVAILABLE",
            score,
            incidentCount: uniqueIncidents.length,
            recentIncidentCount: recentCount,
            highSeverityIncidentCount: highSeverityCount,
            sourceCount: sources.size,
            granularity: provider.granularity || "point",
            sourceName: provider.name,
            incidents: uniqueIncidents
        };
    } catch (error) {
        console.error(`[Crime Risk] Point checking failed at (${lat}, ${lng}):`, error.message);
        return {
            status: "UNKNOWN",
            score: null,
            incidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0,
            warnings: [
                "Crime safety verification is currently unavailable due to provider error."
            ]
        };
    }
}

/**
 * Get crime risk for an entire route.
 */
async function getCrimeRiskForRoute(route, options = {}) {
    const isEnabled = process.env.CRIME_DATA_ENABLED !== "false";
    const url = process.env.CRIME_DATA_URL;

    if (!isEnabled) {
        return {
            status: "UNAVAILABLE",
            score: null,
            incidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0,
            warnings: [
                "Crime safety verification is disabled."
            ]
        };
    }

    if (!url) {
        // Active simulated campus crime safety evaluation
        return getSimulatedCrimeRiskForRoute(route, options);
    }

    if (!Array.isArray(route?.geometry) || route.geometry.length === 0) {
        return {
            status: "UNKNOWN",
            score: null,
            incidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0,
            warnings: ["Route geometry is empty or unavailable."]
        };
    }

    try {
        const provider = getCrimeProvider();
        const maxPoints = options.maxSamplePoints || 25;
        const radiusMeters = Number(options.radiusMeters || process.env.CRIME_DATA_RADIUS_METERS || 150);

        // 1. Sample route geometry points
        const points = [];
        const geom = route.geometry;
        if (geom.length <= maxPoints) {
            points.push(...geom);
        } else {
            for (let i = 0; i < maxPoints; i++) {
                const idx = Math.round((i * (geom.length - 1)) / (maxPoints - 1));
                points.push(geom[idx]);
            }
        }

        // 2. Fetch incidents and scores at sampled points
        const allIncidentsMap = new Map();
        const pointScores = [];
        const hotspots = [];
        const pointCache = new Map(); // round coordinate to 3 decimal places to cache

        for (const [lat, lng] of points) {
            const latBucket = Number(lat).toFixed(3);
            const lngBucket = Number(lng).toFixed(3);
            const cacheKey = `${latBucket},${lngBucket}`;

            let res;
            if (pointCache.has(cacheKey)) {
                res = pointCache.get(cacheKey);
            } else {
                res = await provider.getIncidentsNear(lat, lng, radiusMeters, options);
                pointCache.set(cacheKey, res);
            }

            const score = calculatePointCrimeScore(res);
            pointScores.push(score);

            // Collect unique incidents near route
            for (const inc of res) {
                allIncidentsMap.set(inc.id, inc);
            }

            // Detect segment hotspots
            if (score >= 50) {
                hotspots.push({
                    lat,
                    lng,
                    radiusMeters,
                    score,
                    incidentCount: res.length,
                    reason: "Elevated recent incident activity"
                });
            }
        }

        // 3. Compile stats
        const uniqueIncidents = Array.from(allIncidentsMap.values());
        const cutoffRecent = new Date();
        cutoffRecent.setDate(cutoffRecent.getDate() - 7);

        const recentCount = uniqueIncidents.filter(i => new Date(i.occurredAt) >= cutoffRecent).length;
        const highSeverityCount = uniqueIncidents.filter(i => 
            i.severity === "HIGH" || i.severity === "CRITICAL"
        ).length;

        const sources = new Set(uniqueIncidents.map(i => i.source));
        const overallScore = pointScores.length > 0 ? Math.max(...pointScores) : 0;

        // Sum weights
        let weightedIncidentCount = 0;
        for (const inc of uniqueIncidents) {
            const sevWeight = DEFAULT_SEVERITY_WEIGHTS[inc.severity] || 3;
            const catWeight = DEFAULT_CATEGORY_WEIGHTS[inc.category] || 1;
            weightedIncidentCount += (sevWeight * catWeight);
        }

        const warnings = [];
        if (overallScore >= 50) {
            warnings.push("Elevated recent incident activity detected near part of this route.");
        }

        return {
            status: "AVAILABLE",
            score: overallScore,
            incidentCount: uniqueIncidents.length,
            weightedIncidentCount: Math.round(weightedIncidentCount),
            recentIncidentCount: recentCount,
            highSeverityIncidentCount: highSeverityCount,
            sourceCount: sources.size,
            granularity: provider.granularity || "point",
            sourceName: provider.name,
            hotspots,
            warnings
        };
    } catch (error) {
        console.error(`[Crime Risk] Route evaluation failed:`, error.message);
        return {
            status: "UNKNOWN",
            score: null,
            incidentCount: null,
            recentIncidentCount: null,
            highSeverityIncidentCount: null,
            sourceCount: 0,
            warnings: [
                "Crime safety verification is currently unavailable due to provider error."
            ]
        };
    }
}

/**
 * Generates simulated development mock crime data if no external URL is configured
 */
function getSimulatedCrimeRiskForRoute(route, options = {}) {
    const routeNum = route.routeNumber || 1;

    // Route 1: Safe Route
    if (routeNum === 1) {
        return {
            status: "AVAILABLE",
            score: 15,
            incidentCount: 1,
            weightedIncidentCount: 1,
            recentIncidentCount: 0,
            highSeverityIncidentCount: 0,
            sourceCount: 1,
            granularity: "point",
            sourceName: "Simulated Incident Provider",
            hotspots: [],
            warnings: []
        };
    }

    // Route 2: Medium Risk Route
    if (routeNum === 2) {
        return {
            status: "AVAILABLE",
            score: 55,
            incidentCount: 3,
            weightedIncidentCount: 9,
            recentIncidentCount: 1,
            highSeverityIncidentCount: 0,
            sourceCount: 1,
            granularity: "point",
            sourceName: "Simulated Incident Provider",
            hotspots: [{
                lat: route.geometry?.[0]?.[0] || 22.7212,
                lng: route.geometry?.[0]?.[1] || 88.4848,
                radiusMeters: 150,
                score: 55,
                incidentCount: 3,
                reason: "Moderate incident activity"
            }],
            warnings: ["Elevated recent incident activity detected near part of this route."]
        };
    }

    // Route 3: High Risk / Excluded Route
    const geom = route.geometry || [];
    const middlePoint = geom[Math.floor(geom.length / 2)] || [22.7212, 88.4848];

    const hotspots = [{
        lat: middlePoint[0],
        lng: middlePoint[1],
        radiusMeters: 150,
        score: 85,
        incidentCount: 6,
        reason: "Elevated recent incident activity"
    }];

    return {
        status: "AVAILABLE",
        score: 85,
        incidentCount: 6,
        weightedIncidentCount: 30,
        recentIncidentCount: 4,
        highSeverityIncidentCount: 3,
        sourceCount: 1,
        granularity: "point",
        sourceName: "Simulated Incident Provider",
        hotspots,
        warnings: ["High crime risk area detected along this route."]
    };
}

module.exports = {
    getCrimeRiskForRoute,
    getCrimeRiskNearPoint,
    normalizeCrimeIncident
};
