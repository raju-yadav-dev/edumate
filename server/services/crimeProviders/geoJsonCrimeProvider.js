const axios = require("axios");
const locationHelper = require("../../utils/locationHelper");

let cachedFeatures = null;
let cacheTimestamp = 0;

class GeoJsonCrimeProvider {
    constructor() {
        this.name = "Generic GeoJSON Incident Provider";
        this.type = "geojson";
        this.granularity = "point";
        this.verified = true;
    }

    /**
     * Downloads and caches the GeoJSON file.
     */
    async fetchGeoJson(url, apiKey, ttlSeconds) {
        const now = Date.now();
        const ttlMs = (ttlSeconds || 600) * 1000;

        if (cachedFeatures && (now - cacheTimestamp < ttlMs)) {
            console.log("[Crime Provider] Using cached GeoJSON features");
            return cachedFeatures;
        }

        console.log(`[Crime Provider] Fetching GeoJSON from: ${url}`);
        const headers = {};
        if (apiKey) {
            headers["Authorization"] = apiKey;
            headers["x-api-key"] = apiKey;
        }

        const response = await axios.get(url, { headers, timeout: 5000 });
        const geoJson = response.data;

        if (!geoJson || typeof geoJson !== "object") {
            throw new Error("Invalid GeoJSON response from crime data URL.");
        }

        if (geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
            throw new Error("Response is not a valid GeoJSON FeatureCollection.");
        }

        cachedFeatures = geoJson.features;
        cacheTimestamp = now;
        console.log(`[Crime Provider] Cached ${cachedFeatures.length} crime incidents.`);
        return cachedFeatures;
    }

    /**
     * Finds crime incidents near a given lat/lng point.
     */
    async getIncidentsNear(lat, lng, radiusMeters, options = {}) {
        const url = options.url || process.env.CRIME_DATA_URL;
        if (!url) {
            throw new Error("CRIME_DATA_URL is not configured.");
        }

        const apiKey = options.apiKey || process.env.CRIME_DATA_API_KEY;
        const ttlSeconds = Number(options.cacheTtl || process.env.CRIME_DATA_CACHE_TTL_SECONDS || 600);
        const lookbackDays = Number(options.lookbackDays || process.env.CRIME_DATA_LOOKBACK_DAYS || 90);

        const features = await this.fetchGeoJson(url, apiKey, ttlSeconds);
        const incidents = [];

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

        for (const feature of features) {
            if (!feature.geometry || feature.geometry.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) {
                continue;
            }

            const [fLng, fLat] = feature.geometry.coordinates;

            if (isNaN(fLat) || isNaN(fLng) || fLat < -90 || fLat > 90 || fLng < -180 || fLng > 180) {
                continue;
            }

            // Quick bounding box filter: ~111km per degree
            const degRadius = radiusMeters / 111000;
            if (Math.abs(fLat - lat) > degRadius || Math.abs(fLng - lng) > degRadius) {
                continue;
            }

            const distKm = locationHelper.haversineDistance(lat, lng, fLat, fLng);
            const distMeters = distKm * 1000;

            if (distMeters <= radiusMeters) {
                const props = feature.properties || {};
                const normalized = this.normalizeCrimeIncident(props, fLat, fLng);

                // Filter by lookback date
                const occurredAt = new Date(normalized.occurredAt);
                if (occurredAt >= cutoffDate) {
                    incidents.push({
                        ...normalized,
                        distanceMeters: distMeters
                    });
                }
            }
        }

        return incidents;
    }

    /**
     * Normalizes a raw incident object into standard structure.
     */
    normalizeCrimeIncident(rawIncident, lat, lng) {
        const id = rawIncident.id || rawIncident._id || rawIncident.incident_id || String(Math.random());
        const category = String(rawIncident.category || rawIncident.type || "OTHER").toUpperCase();
        const severity = String(rawIncident.severity || "MEDIUM").toUpperCase();
        const occurredAt = rawIncident.occurredAt || rawIncident.date || rawIncident.time || new Date().toISOString();
        const source = rawIncident.source || rawIncident.provider || "official_source";
        const verified = rawIncident.verified !== undefined ? !!rawIncident.verified : true;

        return {
            id,
            lat,
            lng,
            category,
            severity,
            occurredAt,
            source,
            verified
        };
    }
}

module.exports = GeoJsonCrimeProvider;
