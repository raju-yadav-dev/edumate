const GeoJsonCrimeProvider = require("./geoJsonCrimeProvider");

let geoJsonProviderInstance = null;

function getCrimeProvider(name = process.env.CRIME_DATA_FORMAT || "geojson") {
    const cleanName = String(name || "").toLowerCase();
    if (cleanName === "geojson") {
        if (!geoJsonProviderInstance) {
            geoJsonProviderInstance = new GeoJsonCrimeProvider();
        }
        return geoJsonProviderInstance;
    }
    throw new Error(`Unsupported crime provider: ${name}`);
}

module.exports = {
    getCrimeProvider
};
