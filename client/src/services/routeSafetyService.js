const OVERPASS_URL =
    process.env.OVERPASS_URL ||
    "https://overpass-api.de/api/interpreter";

const SAFETY_RADIUS_METERS = Number(
    process.env.ROUTE_SAFETY_RADIUS_METERS || 60
);

/**
 * Check OSM/Overpass hazards around a route point.
 *
 * Detects:
 * - mapped construction
 * - road access restrictions
 * - mapped flood/flood-prone information
 * - other mapped hazards
 *
 * IMPORTANT:
 * OSM data is not guaranteed to be real-time.
 */
async function queryOverpass(lat, lng) {
    const query = `
[out:json][timeout:20];

(
    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["highway"="construction"];
    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["construction"];

    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["access"="no"];
    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["vehicle"="no"];
    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["motor_vehicle"="no"];

    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["flood_prone"];
    node(around:${SAFETY_RADIUS_METERS},${lat},${lng})["flood_prone"];

    way(around:${SAFETY_RADIUS_METERS},${lat},${lng})["hazard"];
    node(around:${SAFETY_RADIUS_METERS},${lat},${lng})["hazard"];
);

out tags center;
`;

    const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "EduMate-AI/1.0"
        },
        body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
        throw new Error(
            `Overpass API returned ${response.status}`
        );
    }

    return response.json();
}

/**
 * Take a route and reduce its geometry to a manageable
 * number of points.
 *
 * This avoids sending hundreds of Overpass requests.
 */
function sampleRouteGeometry(
    geometry,
    maxPoints = 20
) {
    if (!Array.isArray(geometry)) {
        return [];
    }

    if (geometry.length <= maxPoints) {
        return geometry;
    }

    const result = [];

    for (let i = 0; i < maxPoints; i++) {
        const index = Math.round(
            (i * (geometry.length - 1)) /
            (maxPoints - 1)
        );

        result.push(geometry[index]);
    }

    return result;
}

/**
 * Convert Overpass elements into our internal
 * hazard structure.
 */
function classifyHazards(elements = []) {
    const hazards = {
        flood: [],
        construction: [],
        roadClosure: [],
        other: []
    };

    for (const element of elements) {
        const tags = element.tags || {};

        // FLOOD
        if (
            tags.flood_prone === "yes" ||
            tags.hazard === "flood" ||
            tags.hazard === "flooding"
        ) {
            hazards.flood.push({
                type: "flood",
                tags
            });
        }

        // CONSTRUCTION
        if (
            tags.highway === "construction" ||
            tags.construction
        ) {
            hazards.construction.push({
                type: "construction",
                tags
            });
        }

        // ROAD CLOSED / RESTRICTED
        if (
            tags.access === "no" ||
            tags.vehicle === "no" ||
            tags.motor_vehicle === "no"
        ) {
            hazards.roadClosure.push({
                type: "road_closure",
                tags
            });
        }

        // OTHER HAZARDS
        if (
            tags.hazard &&
            tags.hazard !== "flood" &&
            tags.hazard !== "flooding"
        ) {
            hazards.other.push({
                type: tags.hazard,
                tags
            });
        }
    }

    return hazards;
}

/**
 * Remove duplicate hazard objects.
 */
function removeDuplicates(items) {
    const seen = new Set();

    return items.filter(item => {
        const key = JSON.stringify(item);

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

/**
 * Evaluate a single route.
 */
async function evaluateRoute(route) {
    const result = {
        safe: true,
        riskLevel: "LOW",
        riskScore: 0,

        hazards: {
            flood: [],
            construction: [],
            roadClosure: [],
            other: []
        },

        warnings: []
    };

    if (
        !route ||
        !Array.isArray(route.geometry) ||
        route.geometry.length === 0
    ) {
        result.safe = false;
        result.riskLevel = "UNKNOWN";

        result.warnings.push(
            "Route geometry is unavailable, so safety could not be checked."
        );

        return result;
    }

    const points = sampleRouteGeometry(
        route.geometry,
        20
    );

    /*
     * We intentionally run these sequentially instead
     * of sending a huge number of simultaneous requests.
     */
    for (const point of points) {
        const [lat, lng] = point;

        try {
            const data = await queryOverpass(
                lat,
                lng
            );

            const hazards = classifyHazards(
                data.elements || []
            );

            result.hazards.flood.push(
                ...hazards.flood
            );

            result.hazards.construction.push(
                ...hazards.construction
            );

            result.hazards.roadClosure.push(
                ...hazards.roadClosure
            );

            result.hazards.other.push(
                ...hazards.other
            );
        } catch (error) {
            console.warn(
                "[Route Safety] Overpass check failed:",
                error.message
            );

            result.warnings.push(
                "Some external road-safety information could not be checked."
            );
        }
    }

    /*
     * Remove duplicate results.
     */
    result.hazards.flood =
        removeDuplicates(result.hazards.flood);

    result.hazards.construction =
        removeDuplicates(result.hazards.construction);

    result.hazards.roadClosure =
        removeDuplicates(result.hazards.roadClosure);

    result.hazards.other =
        removeDuplicates(result.hazards.other);

    /*
     * =============================================
     * SAFETY RULES
     * =============================================
     */

    // Flood = EXCLUDE
    if (result.hazards.flood.length > 0) {
        result.safe = false;
        result.riskLevel = "UNSAFE";
        result.riskScore += 70;

        result.warnings.push(
            "Flood or flood-prone information was detected along this route."
        );
    }

    // Road closure = EXCLUDE
    if (result.hazards.roadClosure.length > 0) {
        result.safe = false;
        result.riskLevel = "UNSAFE";
        result.riskScore += 80;

        result.warnings.push(
            "A road access restriction was detected along this route."
        );
    }

    // Construction
    if (result.hazards.construction.length > 0) {
        result.riskScore += 30;

        result.warnings.push(
            "Mapped road construction was detected along this route."
        );
    }

    // Other hazards
    if (result.hazards.other.length > 0) {
        result.riskScore += 15;

        result.warnings.push(
            "A mapped road hazard was detected near this route."
        );
    }

    result.riskScore = Math.min(
        result.riskScore,
        100
    );

    /*
     * Final classification
     */
    if (!result.safe) {
        result.riskLevel = "UNSAFE";
    } else if (result.riskScore >= 50) {
        result.riskLevel = "HIGH";
    } else if (result.riskScore >= 25) {
        result.riskLevel = "MEDIUM";
    } else {
        result.riskLevel = "LOW";
    }

    return result;
}

/**
 * Evaluate all routes and remove unsafe routes.
 */
async function filterSafeRoutes(routes) {
    if (!Array.isArray(routes)) {
        return {
            safeRoutes: [],
            excludedRoutes: []
        };
    }

    const safeRoutes = [];
    const excludedRoutes = [];

    for (const route of routes) {
        const safety = await evaluateRoute(route);

        const result = {
            ...route,
            safety
        };

        if (safety.safe) {
            safeRoutes.push(result);
        } else {
            excludedRoutes.push(result);
        }
    }

    /*
     * Safer routes first.
     *
     * If two routes have equal safety,
     * choose the faster one.
     */
    safeRoutes.sort((a, b) => {
        const riskA =
            a.safety?.riskScore ?? 100;

        const riskB =
            b.safety?.riskScore ?? 100;

        if (riskA !== riskB) {
            return riskA - riskB;
        }

        return (
            (a.timeVal || Infinity) -
            (b.timeVal || Infinity)
        );
    });

    /*
     * Mark safest remaining route as recommended.
     */
    safeRoutes.forEach(route => {
        route.recommended = false;
    });

    if (safeRoutes.length > 0) {
        safeRoutes[0].recommended = true;
    }

    return {
        safeRoutes,
        excludedRoutes
    };
}

module.exports = {
    evaluateRoute,
    filterSafeRoutes
};