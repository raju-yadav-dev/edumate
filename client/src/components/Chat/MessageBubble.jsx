import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";

import { Bot, UserRound, MapPin, Navigation, ChevronLeft, ChevronRight, Edit2, Trash, Pin } from "lucide-react";

import ConfidenceBadge from "./ConfidenceBadge";
import CitationCard from "./CitationCard";
import MessageActions from "./MessageActions";
import MapView from "../Map/MapView";
import RouteCard from "../Map/RouteCard";
import DirectionsPanel from "../Map/DirectionsPanel";

function isCitationsOnlyRequest(prevMessage) {
    if (!prevMessage || prevMessage.role !== "user") return false;
    const query = String(prevMessage.content || "").toLowerCase().trim();
    
    return (
        query === "give the supportive document" ||
        query === "give supportive document" ||
        query === "give supportive documents" ||
        query === "show supportive documents" ||
        query === "give the document" ||
        query === "give document" ||
        query === "give documents" ||
        query === "show document" ||
        query === "show documents" ||
        query === "give the source" ||
        query === "give source" ||
        query === "give sources" ||
        query === "show sources" ||
        query === "give source documents" ||
        query === "show source documents" ||
        query === "give pdf" ||
        query === "show pdf" ||
        query === "give pdfs" ||
        query === "show pdfs" ||
        query === "citation" ||
        query === "citations" ||
        query === "reference" ||
        query === "references" ||
        query === "show citation" ||
        query === "show citations" ||
        query === "give citation" ||
        query === "give citations" ||
        query === "show reference" ||
        query === "show references" ||
        query === "give reference" ||
        query === "give references" ||
        query === "give the pdf file" ||
        query === "give the pdf files" ||
        query === "show the pdf file" ||
        query === "show the pdf files" ||
        query.includes("supportive document") ||
        query.includes("supportive doc") ||
        query.startsWith("give document") ||
        query.startsWith("show document") ||
        query.startsWith("give pdf") ||
        query.startsWith("show pdf") ||
        query.startsWith("give source") ||
        query.startsWith("show source")
    );
}

/* Map Block sub-component */
function MapBlock({ mapData, onLocationAction }) {
    const [activeRouteIndex, setActiveRouteIndex] = useState(0);
    const [manualLocation, setManualLocation] = useState("");
    const [requestingGeo, setRequestingGeo] = useState(false);
    const [geoError, setGeoError] = useState("");
    const [showExcluded, setShowExcluded] = useState(false);

    if (mapData.type === "permission_request") {
        const handleRequestGeo = () => {
            setRequestingGeo(true);
            setGeoError("");
            
            if (!navigator.geolocation) {
                setGeoError("Geolocation is not supported by your browser.");
                setRequestingGeo(false);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setRequestingGeo(false);
                    if (onLocationAction) {
                        onLocationAction({
                            type: "gps",
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    let errMsg = "Location permission denied.";
                    if (error.code === 1) errMsg = "Location permission denied.";
                    else if (error.code === 2) errMsg = "Position unavailable.";
                    else if (error.code === 3) errMsg = "Request timed out.";
                    setGeoError(errMsg);
                    setRequestingGeo(false);
                }
            );
        };

        const handleManualSubmit = (e) => {
            e.preventDefault();
            if (!manualLocation.trim()) return;
            if (onLocationAction) {
                onLocationAction({
                    type: "manual",
                    value: manualLocation.trim()
                });
            }
        };

        return (
            <div 
                className="edu-location-permission-box"
                style={{
                    background: "var(--background-secondary, #f8fafc)",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: "12px",
                    padding: "16px",
                    margin: "12px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-color, #2563eb)" }}>
                    <MapPin size={18} />
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>Location Access Required</span>
                </div>
                
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary, #475569)", lineHeight: "1.5" }}>
                    To show route directions and costs, EduMate needs a starting point. Choose GPS access or type manually.
                </p>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                        onClick={handleRequestGeo}
                        disabled={requestingGeo}
                        style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--primary-color, #2563eb)",
                            color: "#ffffff",
                            fontSize: "13px",
                            fontWeight: "500",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                    >
                        <Navigation size={14} />
                        {requestingGeo ? "Requesting..." : "Allow Geolocation"}
                    </button>
                </div>

                {geoError && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "2px" }}>
                        ⚠️ {geoError}
                    </div>
                )}

                <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <input
                        type="text"
                        placeholder="Or enter start location manually (e.g. Airport)..."
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border-color, #cbd5e1)",
                            fontSize: "13px",
                            background: "var(--background-primary, #ffffff)",
                            color: "var(--text-primary, #0f172a)"
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!manualLocation.trim()}
                        style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--text-primary, #1e293b)",
                            color: "#ffffff",
                            fontSize: "13px",
                            fontWeight: "500",
                            cursor: "pointer"
                        }}
                    >
                        Go
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="edu-map-payload-wrapper">
            {mapData.type === "routing" && (
                <>
                    <MapView
                        startLocation={mapData.startLocation}
                        destination={mapData.destination}
                        routes={mapData.routes}
                        activeRouteIndex={activeRouteIndex}
                        setActiveRouteIndex={setActiveRouteIndex}
                        type="routing"
                        excludedRoutes={mapData.excludedRoutes || []}
                        showExcluded={showExcluded}
                    />
                    <RouteCard
                        routes={mapData.routes}
                        activeRouteIndex={activeRouteIndex}
                        setActiveRouteIndex={setActiveRouteIndex}
                        startLocation={mapData.startLocation}
                        destination={mapData.destination}
                        excludedRoutes={mapData.excludedRoutes || []}
                        showExcluded={showExcluded}
                        setShowExcluded={setShowExcluded}
                    />
                    <DirectionsPanel
                        instructions={mapData.routes[activeRouteIndex]?.instructions}
                    />
                </>
            )}
            {mapData.type === "nearby" && (
                <MapView
                    center={mapData.center}
                    places={mapData.places}
                    type="nearby"
                />
            )}
        </div>
    );
}

function MessageBubble({
    message,
    prevMessage,
    onCopy,
    onRegenerate,
    onShare,
    onBookmark,
    onRate,
    onExportMarkdown,
    onDownloadPdf,
    onLocationAction,
    siblings = [],
    onSwitchBranch,
    onEditMessage,
    onDeleteMessage,
    onPinMessage,
    onExportDocx
}) {
    const isUser = message.role === "user";
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.content);
    const showCitations = (() => {
        if (!Array.isArray(message.sources) || message.sources.length === 0) {
            return false;
        }

        if (message.sourceLabel === "📚 University Documents") {
            return true;
        }

        if (prevMessage && prevMessage.role === "user") {
            const query = String(prevMessage.content || "").toLowerCase();
            return (
                query.includes("supportive document") ||
                query.includes("supportive doc") ||
                query.includes("give document") ||
                query.includes("show document") ||
                query.includes("give source") ||
                query.includes("show source") ||
                query.includes("citation") ||
                query.includes("reference") ||
                query.includes("where did you get") ||
                query.includes("which document") ||
                query.includes("pdf file") ||
                query.includes("source file") ||
                query.includes("document name") ||
                query.includes("support doc") ||
                query.includes("attached doc")
            );
        }

        return false;
    })();

    const displayContent = (() => {
        if (!isUser && showCitations && (isCitationsOnlyRequest(prevMessage) || message.sourceLabel === "📚 University Documents")) {
            return "Here are the supportive documents:";
        }
        return message.content;
    })();

    const handleCitationClick = (citation) => {
        if (message.onCitationClick) {
            message.onCitationClick(citation);
            return;
        }

        const url = citation.downloadUrl || (citation.type === "web" || citation.type === "university_website" ? citation.reference : null);
        if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <article className={`edu-chat-message ${isUser ? "edu-chat-message-user" : "edu-chat-message-assistant"}`}>
            <div className="edu-chat-message-avatar" aria-hidden="true">
                {isUser ? <UserRound size={16} /> : <Bot size={16} />}
            </div>

            <div className="edu-chat-message-body" id={`msg-${message.id}`}>
                <div className="edu-chat-message-panel">
                    <div className="edu-chat-message-meta" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <strong>{isUser ? "You" : "EduMate"}</strong>
                        <span>{message.timestamp}</span>
                        {message.confidence ? <ConfidenceBadge value={message.confidence} /> : null}
                        {message.bookmarked ? <span className="edu-chat-bookmark-pill">Bookmarked</span> : null}
                        {message.reaction ? <span className={`edu-chat-reaction-pill edu-chat-reaction-${message.reaction}`}>{message.reaction}</span> : null}
                        {message.pinned ? <span className="edu-chat-pinned-pill" style={{ background: "var(--warning)", color: "#000", padding: "1px 6px", borderRadius: "8px", fontSize: "11px" }}>Pinned</span> : null}

                        {/* Sibling Branch Switcher */}
                        {siblings && siblings.length > 1 && (
                            <div className="branch-selector" style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: "12px", fontSize: "11px", marginLeft: "8px" }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const idx = siblings.findIndex(s => s.id === message.id);
                                        if (idx > 0 && onSwitchBranch) {
                                            onSwitchBranch(message.parentId || "root", siblings[idx - 1].id);
                                        }
                                    }}
                                    disabled={siblings.findIndex(s => s.id === message.id) <= 0}
                                    style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0" }}
                                    aria-label="Previous version"
                                >
                                    <ChevronLeft size={12} />
                                </button>
                                <span>{siblings.findIndex(s => s.id === message.id) + 1}/{siblings.length}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const idx = siblings.findIndex(s => s.id === message.id);
                                        if (idx !== -1 && idx < siblings.length - 1 && onSwitchBranch) {
                                            onSwitchBranch(message.parentId || "root", siblings[idx + 1].id);
                                        }
                                    }}
                                    disabled={siblings.findIndex(s => s.id === message.id) >= siblings.length - 1}
                                    style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0" }}
                                    aria-label="Next version"
                                >
                                    <ChevronRight size={12} />
                                </button>
                            </div>
                        )}

                        {/* Quick Actions (Edit, Pin, Delete) */}
                        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", opacity: 0.7 }}>
                            {isUser && !isEditing && onEditMessage && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                                    title="Edit query"
                                >
                                    <Edit2 size={12} />
                                </button>
                            )}
                            {onPinMessage && (
                                <button
                                    type="button"
                                    onClick={() => onPinMessage(message)}
                                    style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                                    title={message.pinned ? "Unpin message" : "Pin message"}
                                >
                                    <Pin size={12} style={message.pinned ? { fill: "currentColor" } : {}} />
                                </button>
                            )}
                            {onDeleteMessage && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteMessage(message)}
                                    style={{ border: "none", background: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", color: "var(--danger)" }}
                                    title="Delete message"
                                >
                                    <Trash size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="edu-chat-message-edit-container" style={{ marginTop: "8px", width: "100%" }}>
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                style={{
                                    width: "100%",
                                    minHeight: "60px",
                                    padding: "8px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg)",
                                    color: "var(--text)",
                                    fontFamily: "inherit",
                                    fontSize: "14px"
                                }}
                            />
                            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                                <button
                                    onClick={() => {
                                        if (editText.trim() && editText.trim() !== message.content) {
                                            onEditMessage(message, editText.trim());
                                        }
                                        setIsEditing(false);
                                    }}
                                    style={{
                                        padding: "4px 10px",
                                        background: "var(--primary)",
                                        color: "var(--on-primary)",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "500",
                                        cursor: "pointer"
                                    }}
                                >
                                    Save & Submit
                                </button>
                                <button
                                    onClick={() => {
                                        setEditText(message.content);
                                        setIsEditing(false);
                                    }}
                                    style={{
                                        padding: "4px 10px",
                                        background: "none",
                                        border: "1px solid var(--border)",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={`edu-chat-markdown ${isUser ? "edu-chat-markdown-user" : ""}`}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeHighlight]}
                            components={{
                                code({ inline, className, children, ...props }) {
                                    const languageMatch = /language-(\w+)/.exec(className || "");
                                    const languageLabel = languageMatch?.[1] || "code";

                                    if (inline) {
                                        return <code className="edu-chat-inline-code" {...props}>{children}</code>;
                                    }

                                    return (
                                        <pre className="edu-chat-code-block" {...props}>
                                            <div className="edu-chat-code-header">{languageLabel}</div>
                                            <code className={className}>{children}</code>
                                        </pre>
                                    );
                                },
                                table({ children }) {
                                    return <div className="edu-chat-table-wrap"><table>{children}</table></div>;
                                },
                                th({ children }) {
                                    return <th>{children}</th>;
                                },
                                td({ children }) {
                                    return <td>{children}</td>;
                                },
                                img({ src, alt }) {
                                    return <img className="edu-chat-inline-image" src={src} alt={alt} />;
                                }
                            }}
                        >
                            {displayContent}
                        </ReactMarkdown>
                    </div>)}

                    {/* Interactive Map Block */}
                    {!isUser && message.mapData && (
                        <MapBlock 
                            mapData={message.mapData} 
                            onLocationAction={(action) => onLocationAction && onLocationAction(message.id, action)}
                        />
                    )}

                    {showCitations ? (
                        <div className="edu-chat-citations">
                            <p className="edu-chat-section-label">Sources</p>
                            <div className="edu-chat-citation-grid">
                                {message.sources.map((citation) => (
                                    <CitationCard key={`${citation.title}-${citation.page}-${citation.section}`} citation={citation} onClick={() => handleCitationClick(citation)} />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {!isUser ? (
                        <MessageActions
                            message={message}
                            onCopy={onCopy}
                            onRegenerate={onRegenerate}
                            onShare={onShare}
                            onBookmark={onBookmark}
                            onRate={onRate}
                            onExportMarkdown={onExportMarkdown}
                            onDownloadPdf={onDownloadPdf}
                            onExportDocx={onExportDocx}
                        />
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default MessageBubble;