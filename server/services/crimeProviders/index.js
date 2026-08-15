const GeoJsonCrimeProvider = require("./geoJsonCrimeProvider");

function getCrimeProvider(name = process.env.CRIME_DATA_FORMAT || "geojson") {
    const cleanName = String(name || "").toLowerCase();
    if (cleanName === "geojson") {
        return new GeoJsonCrimeProvider();
    }
    throw new Error(`Unsupported crime provider: ${name}`);
}

module.exports = {
    getCrimeProvider
};
