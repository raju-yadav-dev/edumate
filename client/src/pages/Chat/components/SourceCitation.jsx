import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, CheckCircle, Globe, ExternalLink, Bookmark, Folder } from "lucide-react";
import "../styles/SourceCitation.css";

export default function SourceCitation({ sources = [] }) {
    const [expanded, setExpanded] = useState(true);
    const [selectedSnippetIdx, setSelectedSnippetIdx] = useState(null);

    if (!sources || sources.length === 0) {
        return (
            <div className="source-citations-container no-source">
                <span className="no-source-text">No document source used.</span>
            </div>
        );
    }

    const toggleSnippet = (e, idx) => {
        e.stopPropagation();
        setSelectedSnippetIdx(prev => prev === idx ? null : idx);
    };

    return (
        <div className="source-citations-container">
            <button
                type="button"
                className="citation-toggle-button"
                onClick={() => setExpanded(prev => !prev)}
                aria-expanded={expanded}
            >
                <span className="citation-header-text">
                    <CheckCircle className="check-icon" size={16} />
                    Verified from <b>{sources.length}</b> institutional source{sources.length > 1 ? "s" : ""}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
                <div className="citations-list">
                    {sources.map((src, idx) => {
                        const isWeb = src.type === "web" || src.type === "university_website";
                        const targetUrl = src.downloadUrl || (isWeb ? src.reference : null);
                        const category = src.category || src.metadata?.category;
                        const department = src.department || src.metadata?.department;
                        const snippet = src.snippet || src.metadata?.snippet;
                        const isSnippetOpen = selectedSnippetIdx === idx;
                        const pageText = src.page && String(src.page).includes(",") ? `Pages ${src.page}` : `Page ${src.page || "1"}`;

                        return (
                            <div 
                                key={idx} 
                                className={`citation-badge-card ${isWeb ? "web" : "document"} ${isSnippetOpen ? "active-snippet" : ""}`}
                            >
                                <div className="citation-card-main">
                                    <span className={`pdf-icon-wrapper ${isWeb ? "web" : "document"}`}>
                                        {isWeb ? <Globe size={18} /> : <FileText size={18} />}
                                    </span>
                                    <div className="citation-metadata">
                                        <h4 className="citation-doc-title" title={src.title}>{src.title}</h4>
                                        <p className="citation-doc-reference">
                                            {isWeb ? src.metadata?.domain || src.reference || "University Webpage" : `${pageText} · ${src.section || "General"}`}
                                        </p>
                                    </div>

                                    {targetUrl && (
                                        <a 
                                            href={targetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="citation-open-preview-icon"
                                            title="Open document preview"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>

                                <div className="citation-card-tags">
                                    {isWeb && (
                                        <span className="citation-tag web-badge">
                                            🌐 Web
                                        </span>
                                    )}
                                    {!isWeb && category && (
                                        <span className="citation-tag category">
                                            <Folder size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                                            {String(category).replace(/_/g, " ")}
                                        </span>
                                    )}
                                    {!isWeb && department && (
                                        <span className="citation-tag department">
                                            <Bookmark size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                                            {department}
                                        </span>
                                    )}
                                    {src.similarity !== undefined && (
                                        <span className="citation-tag similarity">
                                            {src.similarity}% match
                                        </span>
                                    )}
                                    {snippet && (
                                        <button 
                                            type="button"
                                            className="citation-view-snippet-btn"
                                            onClick={(e) => toggleSnippet(e, idx)}
                                        >
                                            {isSnippetOpen ? "Hide Excerpt" : "View Excerpt"}
                                        </button>
                                    )}
                                </div>

                                {snippet && isSnippetOpen && (
                                    <div className="citation-excerpt-preview">
                                        <span className="citation-excerpt-title">Highlighted Context:</span>
                                        <p className="citation-excerpt-content">"{snippet}"</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

