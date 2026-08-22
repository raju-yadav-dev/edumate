import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, CheckCircle, Globe } from "lucide-react";
import "../styles/SourceCitation.css";

export default function SourceCitation({ sources = [] }) {
    const [expanded, setExpanded] = useState(false);

    if (!sources || sources.length === 0) return null;

    return (
        <div className="source-citations-container">
            <button
                className="citation-toggle-button"
                onClick={() => setExpanded(prev => !prev)}
            >
                <span className="citation-header-text">
                    <CheckCircle className="check-icon" size={16} />
                    Answer verified from <b>{sources.length}</b> source{sources.length > 1 ? "s" : ""}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
                <div className="citations-list">
                    {sources.map((src, idx) => {
                        const isWeb = src.type === "web";
                        const targetUrl = isWeb ? src.reference : src.downloadUrl;
                        const CardWrapper = targetUrl ? "a" : "div";
                        const extraProps = targetUrl ? {
                            href: targetUrl,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            style: { textDecoration: "none" }
                        } : {};

                        return (
                            <CardWrapper 
                                key={idx} 
                                className={`citation-badge-card ${isWeb ? "web" : "document"} ${targetUrl ? "clickable-citation-card" : ""}`}
                                {...extraProps}
                            >
                                <div className="citation-card-main">
                                    <span className={`pdf-icon-wrapper ${isWeb ? "web" : "document"}`}>
                                        {isWeb ? <Globe size={18} /> : <FileText size={18} />}
                                    </span>
                                    <div className="citation-metadata">
                                        <h4 className="citation-doc-title" title={src.title}>{src.title}</h4>
                                        <p className="citation-doc-reference">
                                            {isWeb ? src.metadata?.domain || "Web Source" : src.reference}
                                        </p>
                                    </div>
                                </div>
                                <div className="citation-card-tags">
                                    {isWeb && (
                                        <span className="citation-tag web-badge">
                                            🌐 Web
                                        </span>
                                    )}
                                    {!isWeb && src.metadata?.category && (
                                        <span className="citation-tag category">
                                            {String(src.metadata.category).replace(/_/g, " ")}
                                        </span>
                                    )}
                                    {!isWeb && src.metadata?.department && (
                                        <span className="citation-tag department">
                                            {src.metadata.department}
                                        </span>
                                    )}
                                    {!isWeb && src.metadata?.similarity !== undefined && (
                                        <span className="citation-tag similarity">
                                            {src.metadata.similarity}% match
                                        </span>
                                    )}
                                </div>
                            </CardWrapper>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
