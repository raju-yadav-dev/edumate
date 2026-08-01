import { Car, Bike, Train, Footprints } from "lucide-react";

export default function RouteCard({
    routes = [],
    activeRouteIndex = 0,
    setActiveRouteIndex,
    startLocation,
    destination
}) {
    if (!routes || routes.length === 0) return null;

    const activeRoute = routes[activeRouteIndex];

    const getModeIcon = (mode, size = 18) => {
        switch (mode) {
            case "car": return <Car size={size} />;
            case "bike": return <Bike size={size} />;
            case "public_transport": return <Train size={size} />;
            case "walking":
            case "cycling":
            default:
                return <Footprints size={size} />;
        }
    };

    const handleOpenInGoogleMaps = () => {
        if (!startLocation || !destination) return;

        let gMode = "driving";
        if (activeRoute.mode === "bike") gMode = "bicycling";
        else if (activeRoute.mode === "walking") gMode = "walking";
        else if (activeRoute.mode === "public_transport") gMode = "transit";

        const url = `https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${destination.lat},${destination.lng}&travelmode=${gMode}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

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
                gap: "14px"
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
                            key={route.mode}
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
                                fontWeight: "500",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {getModeIcon(route.mode, 16)}
                            <span>{route.label}</span>
                            {route.recommended && (
                                <span 
                                    style={{
                                        fontSize: "10px",
                                        background: "var(--accent-color, #8b5cf6)",
                                        color: "#ffffff",
                                        padding: "1px 6px",
                                        borderRadius: "10px",
                                        marginLeft: "4px"
                                    }}
                                >
                                    Best
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
                        gap: "8px"
                    }}
                >
                    <div 
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary, #0f172a)" }}>
                                {activeRoute.time}
                            </span>
                            <span style={{ color: "var(--text-secondary, #64748b)", fontSize: "14px" }}>
                                ({activeRoute.distance})
                            </span>
                        </div>

                        {activeRoute.recommended && (
                            <span 
                                style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: "#16a34a",
                                    background: "#dcfce7",
                                    padding: "2px 8px",
                                    borderRadius: "12px"
                                }}
                            >
                                Recommended Option
                            </span>
                        )}
                    </div>

                    <div 
                        className="edu-route-meta-grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                            fontSize: "13px",
                            color: "var(--text-secondary, #475569)",
                            padding: "8px 0"
                        }}
                    >
                        <div>
                            ⏱️ <b>ETA:</b> {activeRoute.eta}
                        </div>
                        <div>
                            💵 <b>Estimated Cost:</b> {activeRoute.cost}*
                        </div>
                        <div style={{ gridColumn: "span 2", marginTop: "4px", color: "var(--text-tertiary, #94a3b8)", fontSize: "11px" }}>
                            *All cost values are approximate estimates.
                        </div>
                    </div>

                    {activeRoute.advantages && (
                        <div 
                            style={{
                                padding: "10px 12px",
                                background: "#f1f5f9",
                                borderLeft: "4px solid #94a3b8",
                                borderRadius: "4px",
                                fontSize: "13px",
                                color: "#334155"
                            }}
                        >
                            💡 <b>Advantage:</b> {activeRoute.advantages}
                        </div>
                    )}

                    <button
                        onClick={handleOpenInGoogleMaps}
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginTop: "8px",
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
                        🗺️ Open Route in Google Maps
                    </button>
                </div>
            )}
        </div>
    );
}
