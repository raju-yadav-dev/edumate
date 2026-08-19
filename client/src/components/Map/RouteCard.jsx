import { useState, useEffect } from "react";
import { Car, AlertTriangle, ShieldCheck, Info, ExternalLink } from "lucide-react";

export default function RouteCard({
    routes = [],
    activeRouteIndex = 0,
    setActiveRouteIndex,
    startLocation,
    destination,
    excludedRoutes = [],
    showExcluded = false,
    setShowExcluded
}) {
    const [showWhy, setShowWhy] = useState(false);

    // Reset the "Why?" toggle when active route changes
    useEffect(() => {
        setShowWhy(false);
    }, [activeRouteIndex]);

    if (!routes || routes.length === 0) {
        // If no safe routes but there are excluded routes, let's show a fallback message
        if (excludedRoutes && excludedRoutes.length > 0) {
            return (
                <div 
                    style={{
                        background: "var(--background-secondary, #f8fafc)",
                        border: "1px solid #fee2e2",
                        borderRadius: "12px",
                        padding: "16px",
                        margin: "12px 0",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ef4444", fontWeight: "600" }}>
                        <AlertTriangle size={20} />
                        <span>All routes excluded due to elevated safety risks</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary, #475569)", lineHeight: "1.5" }}>
                        EduMate evaluated the available driving routes and all exceeded the safety thresholds (e.g. active road closures, flood hazards, or higher reported incident risks).
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-tertiary, #94a3b8)" }}>
                            Excluded routes: {excludedRoutes.length}
                        </span>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: "#ef4444", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={showExcluded}
                                onChange={(e) => setShowExcluded(e.target.checked)}
                                style={{ cursor: "pointer" }}
                            />
                            Show Excluded Routes
                        </label>
                    </div>
                </div>
            );
        }
        return null;
    }

    const activeRoute = routes[activeRouteIndex];

    const handleOpenInGoogleMaps = () => {
        if (!startLocation || !destination) return;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const getSafetyBadgeStyle = (riskLevel) => {
        switch (riskLevel) {
            case "LOW":
                return {
                    text: "Safer",
                    background: "#dcfce7",
                    color: "#166534",
                    icon: "🟢"
                };
            case "MEDIUM":
                return {
                    text: "Moderate risk",
                    background: "#fef3c7",
                    color: "#92400e",
                    icon: "🟡"
                };
            case "HIGH":
                return {
                    text: "High risk",
                    background: "#fee2e2",
                    color: "#991b1b",
                    icon: "🔴"
                };
            case "UNKNOWN":
            default:
                return {
                    text: "Safety unavailable",
                    background: "#f1f5f9",
                    color: "#475569",
                    icon: "⚪"
                };
        }
    };

    const getCrimeActivityText = (score) => {
        if (score === null || score === undefined) return "Unavailable";
        if (score === 0) return "None";
        if (score <= 25) return "Low";
        if (score <= 60) return "Medium";
        return "High";
    };

    const safetyBadge = getSafetyBadgeStyle(activeRoute.safety?.riskLevel);

    return (
        <div 
            className="edu-route-card-wrapper"
            style={{
                background: "var(--background-secondary, #f8fafc)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "12px",
                padding: "16px",
                margin: "12px 0",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                fontFamily: "var(--font-family, inherit)"
            }}
        >
            {/* Tabs Header */}
            <div 
                className="edu-route-tabs-container"
                style={{
                    display: "flex",
                    gap: "8px",
                    borderBottom: "1px solid var(--border-color, #e2e8f0)",
                    paddingBottom: "8px",
                    overflowX: "auto"
                }}
            >
                {routes.map((route, idx) => {
                    const isActive = idx === activeRouteIndex;
                    return (
                        <button
                            key={route.label || idx}
                            onClick={() => setActiveRouteIndex(idx)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid " + (isActive ? "var(--primary-color, #3b82f6)" : "transparent"),
                                background: isActive ? "var(--primary-light, #eff6ff)" : "transparent",
                                color: isActive ? "var(--primary-color, #2563eb)" : "var(--text-secondary, #64748b)",
                                fontWeight: "600",
                                fontSize: "13px",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                whiteSpace: "nowrap"
                            }}
                        >
                            <Car size={15} />
                            <span>{route.label}</span>
                            {route.recommended && (
                                <span 
                                    style={{
                                        fontSize: "9px",
                                        background: "#16a34a",
                                        color: "#ffffff",
                                        padding: "2px 6px",
                                        borderRadius: "10px",
                                        marginLeft: "4px",
                                        fontWeight: "700"
                                    }}
                                >
                                    Safest
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Route Details */}
            {activeRoute && (
                <div 
                    className="edu-active-route-content"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                    }}
                >
                    <div 
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "8px"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                            <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary, #0f172a)" }}>
                                {activeRoute.time}
                            </span>
                            <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "13px" }}>
                                ({activeRoute.distance})
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {activeRoute.recommended && (
                                <span 
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        color: "#16a34a",
                                        background: "#dcfce7",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #bbf7d0"
                                    }}
                                >
                                    Safest Recommended
                                </span>
                            )}
                            
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    background: safetyBadge.background,
                                    color: safetyBadge.color,
                                    fontSize: "11px",
                                    fontWeight: "700"
                                }}
                            >
                                <span>{safetyBadge.icon}</span>
                                <span>{safetyBadge.text}</span>
                            </span>
                        </div>
                    </div>

                    <div 
                        className="edu-route-meta-grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                            fontSize: "13px",
                            color: "var(--text-secondary, #475569)",
                            padding: "6px 0",
                            borderBottom: "1px solid var(--border-color, #e2e8f0)",
                            paddingBottom: "12px"
                        }}
                    >
                        <div>
                            ⏱️ <b>ETA:</b> {activeRoute.eta}
                        </div>
                        <div>
                            💵 <b>Estimated Fuel Cost:</b> {activeRoute.cost}
                        </div>
                    </div>

                    {activeRoute.advantages && (
                        <div 
                            style={{
                                padding: "8px 12px",
                                background: "var(--background-primary, #ffffff)",
                                borderLeft: "4px solid var(--primary-color, #3b82f6)",
                                borderTop: "1px solid var(--border-color, #e2e8f0)",
                                borderBottom: "1px solid var(--border-color, #e2e8f0)",
                                borderRight: "1px solid var(--border-color, #e2e8f0)",
                                borderRadius: "4px",
                                fontSize: "13px",
                                color: "#334155"
                            }}
                        >
                            💡 <b>Advantage:</b> {activeRoute.advantages}
                        </div>
                    )}

                    {/* Safety Details Section */}
                    {activeRoute.safety && (
                        <div
                            style={{
                                background: "#ffffff",
                                border: "1px solid var(--border-color, #e2e8f0)",
                                borderRadius: "8px",
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px"
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary, #0f172a)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <ShieldCheck size={16} style={{ color: "#16a34a" }} />
                                    <span>Safety Verification Status</span>
                                </span>
                                <button
                                    onClick={() => setShowWhy(!showWhy)}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "var(--primary-color, #2563eb)",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "2px 6px",
                                        borderRadius: "4px"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                                >
                                    <Info size={14} />
                                    <span>Why?</span>
                                </button>
                            </div>

                            {/* Aggregated Quick Metrics */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                                <div>🚨 Reported Incident Risk: <b>{getCrimeActivityText(activeRoute.safety.crimeRisk?.score)}</b></div>
                                <div>🚧 Physical Hazards: <b>{
                                    (activeRoute.safety.physicalHazards?.flood || 0) +
                                    (activeRoute.safety.physicalHazards?.construction || 0) +
                                    (activeRoute.safety.physicalHazards?.roadClosure || 0) +
                                    (activeRoute.safety.physicalHazards?.other || 0)
                                } detected</b></div>
                            </div>

                            {/* Expandable "Why?" explanations */}
                            {showWhy && (
                                <div
                                    style={{
                                        marginTop: "8px",
                                        paddingTop: "10px",
                                        borderTop: "1px dashed var(--border-color, #e2e8f0)",
                                        fontSize: "12px",
                                        color: "#475569",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px",
                                        lineHeight: "1.4"
                                    }}
                                >
                                    <div style={{ fontWeight: "600", color: "var(--text-primary, #1e293b)" }}>Safety Metric Breakdown:</div>
                                    
                                    {activeRoute.safety.crimeRisk?.status === "AVAILABLE" ? (
                                        <div style={{ paddingLeft: "8px" }}>
                                            • 📊 Reported incident activity near route: <b>{getCrimeActivityText(activeRoute.safety.crimeRisk.score)}</b> (Risk score: {activeRoute.safety.crimeRisk.score || 0}/100)
                                            <br />
                                            • 📍 Verified incidents within safety radius: <b>{activeRoute.safety.crimeRisk.incidentCount || 0}</b>
                                            <br />
                                            • 🕒 Recent 7-day incidents: <b>{activeRoute.safety.crimeRisk.recentIncidentCount || 0}</b>
                                            <br />
                                            • ⚠️ Recent high-severity incidents: <b>{activeRoute.safety.crimeRisk.highSeverityIncidentCount || 0}</b>
                                        </div>
                                    ) : (
                                        <div style={{ color: "#d97706", paddingLeft: "8px" }}>
                                            • ⚠️ Incident data unavailable: <b>No verified geospatial incident data source is configured.</b>
                                        </div>
                                    )}

                                    <div style={{ paddingLeft: "8px" }}>
                                        • 🛣️ Mapped physical hazards (OSM Overpass):
                                        <div style={{ paddingLeft: "10px", color: "var(--text-secondary, #64748b)" }}>
                                            - Flood-prone zones: {activeRoute.safety.physicalHazards?.flood || 0}
                                            <br />
                                            - Construction zones: {activeRoute.safety.physicalHazards?.construction || 0}
                                            <br />
                                            - Active road closures: {activeRoute.safety.physicalHazards?.roadClosure || 0}
                                            <br />
                                            - Other hazards: {activeRoute.safety.physicalHazards?.other || 0}
                                        </div>
                                    </div>

                                    {activeRoute.safety.warnings && activeRoute.safety.warnings.length > 0 && (
                                        <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "6px 8px", borderRadius: "4px", color: "#b45309", fontSize: "11px" }}>
                                            ⚠️ <b>Alerts:</b> {activeRoute.safety.warnings.join(" ")}
                                        </div>
                                    )}

                                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", fontStyle: "italic" }}>
                                        Advisory Safety Rating: EduMate checks active road closures and verified geospatial statistics to calculate a risk index. Safety is not guaranteed.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                        <button
                            onClick={handleOpenInGoogleMaps}
                            style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border-color, #cbd5e1)",
                                background: "#ffffff",
                                color: "var(--text-primary, #334155)",
                                fontWeight: "600",
                                fontSize: "13px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                boxShadow: "0 1px 2px rgb(0 0 0 / 0.05)",
                                transition: "background 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                        >
                            <ExternalLink size={14} />
                            <span>Open in Google Maps</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Excluded routes toggle at the bottom */}
            {excludedRoutes && excludedRoutes.length > 0 && (
                <div 
                    style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        marginTop: "4px", 
                        borderTop: "1px dashed var(--border-color, #e2e8f0)", 
                        paddingTop: "12px" 
                    }}
                >
                    <span style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", display: "flex", alignItems: "center", gap: "4px" }}>
                        🚫 <b>{excludedRoutes.length} route{excludedRoutes.length > 1 ? "s" : ""}</b> excluded due to safety hazards.
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#ef4444", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={showExcluded}
                            onChange={(e) => setShowExcluded(e.target.checked)}
                            style={{ cursor: "pointer" }}
                        />
                        <span>Show Excluded</span>
                    </label>
                </div>
            )}
        </div>
    );
}
