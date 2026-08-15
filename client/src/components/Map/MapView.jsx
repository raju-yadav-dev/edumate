import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CAMPUS_DEFAULT_LAT = 22.7212;
const CAMPUS_DEFAULT_LNG = 88.4848;

// Custom offline-safe drop-pin shaped SVG Icons for Map markers
const startIcon = L.divIcon({
    className: "custom-marker-start",
    html: `<div style="display: flex; justify-content: center; align-items: center; width: 32px; height: 32px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="#ffffff"/>
        </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32], // Anchor at bottom-center of the pin
    popupAnchor: [0, -32]
});

const destIcon = L.divIcon({
    className: "custom-marker-dest",
    html: `<div style="display: flex; justify-content: center; align-items: center; width: 32px; height: 32px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="#ffffff"/>
        </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const poiIcon = L.divIcon({
    className: "custom-marker-poi",
    html: `<div style="display: flex; justify-content: center; align-items: center; width: 24px; height: 24px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#10b981" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="2.5" fill="#ffffff"/>
        </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

export default function MapView({
    startLocation,
    destination,
    routes = [],
    activeRouteIndex = 0,
    setActiveRouteIndex,
    type = "routing", // 'routing' | 'nearby'
    center,
    places = [],
    excludedRoutes = [],
    showExcluded = false
}) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layersGroupRef = useRef(null);

    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize Map if it doesn't exist
        if (!mapInstanceRef.current) {
            const initialLat = center?.lat || startLocation?.lat || CAMPUS_DEFAULT_LAT;
            const initialLng = center?.lng || startLocation?.lng || CAMPUS_DEFAULT_LNG;

            mapInstanceRef.current = L.map(mapContainerRef.current, {
                center: [initialLat, initialLng],
                zoom: 13,
                zoomControl: true,
                scrollWheelZoom: false // Disable scroll wheel zoom inside chat window for better scrolling
            });

            // Add standard OpenStreetMap tiles
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstanceRef.current);

            // Layer group for dynamic markers/lines
            layersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        }

        const map = mapInstanceRef.current;
        const layersGroup = layersGroupRef.current;

        // Clear existing markers/polylines
        layersGroup.clearLayers();

        const bounds = L.latLngBounds();

        if (type === "routing") {
            // Plot Start & End markers
            if (startLocation?.lat && startLocation?.lng) {
                const startMarker = L.marker([startLocation.lat, startLocation.lng], { icon: startIcon })
                    .bindPopup(`<b>Start:</b> ${startLocation.name || "Your Location"}`);
                layersGroup.addLayer(startMarker);
                bounds.extend([startLocation.lat, startLocation.lng]);
            }

            if (destination?.lat && destination?.lng) {
                const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon })
                    .bindPopup(`<b>Destination:</b> ${destination.name || "Target"}`);
                layersGroup.addLayer(destMarker);
                bounds.extend([destination.lat, destination.lng]);
            }

            // Plot all safe route geometries
            routes.forEach((route, idx) => {
                if (!route.geometry || route.geometry.length === 0) return;

                const isActive = idx === activeRouteIndex;
                const isRecommended = route.recommended;

                // Configure weights & opacity based on selection state
                let weight = 4;
                let opacity = 0.45;
                if (isActive) {
                    weight = 7;
                    opacity = 0.95;
                } else if (isRecommended) {
                    weight = 5;
                    opacity = 0.65;
                }

                // Determine routing safety line colors
                let pathColor = "#3b82f6"; // Default blue
                if (route.safety?.riskLevel === "LOW") {
                    pathColor = isRecommended ? "#10b981" : "#3b82f6"; // green if recommended
                } else if (route.safety?.riskLevel === "MEDIUM") {
                    pathColor = "#f59e0b"; // amber for moderate
                } else if (route.safety?.riskLevel === "HIGH") {
                    pathColor = "#ef4444"; // red for high risk
                } else if (route.safety?.status === "UNKNOWN") {
                    pathColor = "#64748b"; // slate gray for safety unavailable
                }

                const polyline = L.polyline(route.geometry, {
                    color: pathColor,
                    weight,
                    opacity
                });

                // Set up popup details
                const safetyText = route.safety
                    ? route.safety.riskLevel === "LOW"
                        ? "🟢 Safer route"
                        : route.safety.riskLevel === "MEDIUM"
                            ? "🟡 Moderate risk"
                            : route.safety.riskLevel === "HIGH"
                                ? "🔴 High risk"
                                : "⚪ Safety unavailable"
                    : "Safety information unavailable";

                const crimeText = route.safety?.crimeRisk?.status === "AVAILABLE"
                    ? `Crime risk: ${route.safety.crimeRisk.score}/100`
                    : "Crime verification: Unavailable";

                const hazardText = route.safety?.physicalHazards
                    ? `Physical hazards: ${
                        (route.safety.physicalHazards.flood || 0) +
                        (route.safety.physicalHazards.construction || 0) +
                        (route.safety.physicalHazards.roadClosure || 0) +
                        (route.safety.physicalHazards.other || 0)
                      } detected`
                    : "Physical hazards: Unchecked";

                const safetyWarnings = route.safety?.warnings?.length
                    ? `<br/><span style="color: #b45309;">⚠️ <b>Alert:</b> ${route.safety.warnings.join(" ")}</span>`
                    : "";

                polyline.bindPopup(`
                    <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; padding: 4px;">
                        <b>${route.label || "Route"}</b><br/>
                        ⏱️ Time: ${route.time}<br/>
                        📏 Distance: ${route.distance}<br/>
                        💵 Estimated Fuel: ${route.cost}<br/>
                        🛡️ ${safetyText}<br/>
                        📊 ${crimeText}<br/>
                        🚧 ${hazardText}
                        ${safetyWarnings}
                    </div>
                `);

                // Interactivity: Click route path on map to select it
                polyline.on("click", (e) => {
                    if (setActiveRouteIndex) {
                        setActiveRouteIndex(idx);
                        polyline.openPopup(e.latlng);
                    }
                });

                layersGroup.addLayer(polyline);

                // Add crime hotspots for the active route
                if (isActive && route.safety?.crimeRisk?.hotspots) {
                    route.safety.crimeRisk.hotspots.forEach(hotspot => {
                        const circle = L.circle([hotspot.lat, hotspot.lng], {
                            color: "#ef4444",
                            fillColor: "#ef4444",
                            fillOpacity: 0.15,
                            radius: hotspot.radiusMeters || 150
                        }).bindPopup(`
                            <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
                                ⚠️ <b>Elevated recent incident activity</b><br/>
                                Risk score: <b>${hotspot.score}</b><br/>
                                Based on verified incident data within ${hotspot.radiusMeters || 150}m.
                            </div>
                        `);
                        layersGroup.addLayer(circle);
                    });
                }

                if (isActive) {
                    // Extend bounds with the active route geometry
                    route.geometry.forEach(pt => bounds.extend(pt));
                }
            });

            // Plot excluded routes if user explicitly requests
            if (showExcluded && Array.isArray(excludedRoutes)) {
                excludedRoutes.forEach((route) => {
                    if (!route.geometry || route.geometry.length === 0) return;

                    const polyline = L.polyline(route.geometry, {
                        color: "#991b1b",
                        weight: 3,
                        opacity: 0.5,
                        dashArray: "5, 10"
                    }).bindPopup(`
                        <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
                            🚫 <b>${route.label || "Route"} (Excluded)</b><br/>
                            Reason: <b style="color: #ef4444;">${route.reason || "Elevated incident risk"}</b><br/>
                            ⏱️ Time: ${route.time || "N/A"}<br/>
                            📏 Distance: ${route.distance || "N/A"}
                        </div>
                    `);
                    layersGroup.addLayer(polyline);
                });
            }

            // Adjust zoom to fit start, destination, and path
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [40, 40] });
            }

        } else if (type === "nearby") {
            // Plot nearby POIs search
            const centerLat = center?.lat || CAMPUS_DEFAULT_LAT;
            const centerLng = center?.lng || CAMPUS_DEFAULT_LNG;

            const centerMarker = L.marker([centerLat, centerLng], { icon: startIcon })
                .bindPopup(`<b>Center Point:</b> ${center?.name || "Target Location"}`);
            layersGroup.addLayer(centerMarker);
            bounds.extend([centerLat, centerLng]);

            // Draw a subtle 1.5km radius circle
            const circle = L.circle([centerLat, centerLng], {
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.08,
                radius: 1500
            });
            layersGroup.addLayer(circle);

            places.forEach(poi => {
                if (!poi.lat || !poi.lng) return;

                const poiMarker = L.marker([poi.lat, poi.lng], { icon: poiIcon })
                    .bindPopup(`
                        <div style="font-family: sans-serif; font-size: 13px;">
                            <b>${poi.name}</b><br/>
                            📏 Distance: ${poi.distance} km<br/>
                            📍 Address: ${poi.address || "Nearby"}<br/>
                            <a href="https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 5px;">Google Maps</a>
                        </div>
                    `);
                layersGroup.addLayer(poiMarker);
                bounds.extend([poi.lat, poi.lng]);
            });

            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [30, 30] });
            }
        }

        // Trigger Leaflet layout recalculation to prevent gray background / shifting tiles
        const timer = setTimeout(() => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
            }
        }, 150);

        return () => clearTimeout(timer);

    }, [startLocation, destination, routes, activeRouteIndex, type, center, places, excludedRoutes, showExcluded]);

    // Clean up map instance on unmount
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    return (
        <div 
            className="edu-map-view-container" 
            style={{ 
                height: "280px", 
                width: "100%", 
                borderRadius: "12px", 
                overflow: "hidden", 
                border: "1px solid var(--border-color, #e2e8f0)",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                margin: "12px 0",
                zIndex: 1
            }}
        >
            <div 
                ref={mapContainerRef} 
                style={{ 
                    height: "100%", 
                    width: "100%" 
                }} 
            />
        </div>
    );
}
