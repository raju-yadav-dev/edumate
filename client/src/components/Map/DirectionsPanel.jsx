import { useState } from "react";
import { ChevronDown, ChevronUp, Milestone } from "lucide-react";

export default function DirectionsPanel({ instructions = [] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!instructions || instructions.length === 0) return null;

    return (
        <div 
            className="edu-directions-panel-wrapper"
            style={{
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "12px",
                overflow: "hidden",
                margin: "12px 0"
            }}
        >
            {/* Panel Header Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--background-secondary, #f8fafc)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--text-primary, #1e293b)",
                    textAlign: "left"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Milestone size={16} className="text-secondary" />
                    <span>View Turn-by-Turn Navigation ({instructions.length} steps)</span>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Steps Content List */}
            {isOpen && (
                <div 
                    className="edu-directions-list"
                    style={{
                        padding: "16px",
                        background: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        maxHeight: "220px",
                        overflowY: "auto",
                        borderTop: "1px solid var(--border-color, #e2e8f0)"
                    }}
                >
                    {instructions.map((step, idx) => (
                        <div 
                            key={idx}
                            style={{
                                display: "flex",
                                gap: "12px",
                                fontSize: "13px",
                                borderBottom: idx < instructions.length - 1 ? "1px solid #f1f5f9" : "none",
                                paddingBottom: "10px"
                            }}
                        >
                            {/* Step Number Circle */}
                            <div 
                                style={{
                                    minWidth: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    background: "#e2e8f0",
                                    color: "#475569",
                                    fontWeight: "bold",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "11px",
                                    marginTop: "2px"
                                }}
                            >
                                {idx + 1}
                            </div>

                            {/* Step text and distance info */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                <span style={{ color: "var(--text-primary, #334155)", fontWeight: "500", lineHeight: "1.4" }}>
                                    {step.text}
                                </span>
                                <span style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "11px" }}>
                                    {step.distance} • {step.duration}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
