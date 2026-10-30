import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { getApiRootUrl } from "../../services/apiConfig";

export default function KnowledgeStudio() {
    const [reloadKey, setReloadKey] = useState(0);

    // Derive base URL for studio backend
    const apiRoot = getApiRootUrl();
    const backendOrigin = apiRoot.replace(/\/api(\/v1)?\/?$/, "");
    const studioUrl = `${backendOrigin}/studio/`;

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: "100%",
            background: "var(--bg, #f8f7ff)",
            overflow: "hidden"
        }}>
            {/* Top Toolbar */}
            <div style={{
                height: "56px",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--glass, rgba(255, 255, 255, 0.85))",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderBottom: "1px solid var(--glass-border, rgba(0, 0, 0, 0.08))",
                zIndex: 10
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <Link
                        to="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "34px",
                            height: "34px",
                            borderRadius: "10px",
                            background: "rgba(0, 0, 0, 0.04)",
                            color: "var(--text, #111827)",
                            textDecoration: "none",
                            transition: "all 0.2s ease"
                        }}
                        title="Back to Home"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text, #111827)" }}>
                            EduMate Knowledge Studio
                        </span>
                        <span style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: "linear-gradient(135deg, rgba(111, 124, 255, 0.15), rgba(200, 156, 255, 0.2))",
                            color: "var(--primary, #6F7CFF)",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}>
                            <Sparkles size={11} /> Port 5000 Integrated
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={() => setReloadKey((k) => k + 1)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 12px",
                            borderRadius: "10px",
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                            background: "rgba(255, 255, 255, 0.6)",
                            color: "var(--text, #111827)",
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            fontWeight: 500
                        }}
                        title="Reload Studio View"
                    >
                        <RefreshCw size={14} />
                        <span>Reload</span>
                    </button>
                    <a
                        href={studioUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 14px",
                            borderRadius: "10px",
                            background: "var(--primary, #6F7CFF)",
                            color: "#fff",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            textDecoration: "none"
                        }}
                    >
                        <span>Open Standalone</span>
                        <ExternalLink size={13} />
                    </a>
                </div>
            </div>

            {/* Embedded Studio */}
            <iframe
                key={reloadKey}
                src={studioUrl}
                title="EduMate Knowledge Studio"
                allow="clipboard-write; clipboard-read; modals"
                style={{
                    flex: 1,
                    width: "100%",
                    height: "calc(100vh - 56px)",
                    border: "none",
                    background: "#0c1017"
                }}
            />
        </div>
    );
}

