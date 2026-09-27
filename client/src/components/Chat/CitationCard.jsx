import { useState } from "react";
import { FiFileText, FiGlobe, FiChevronDown, FiChevronUp, FiExternalLink, FiFolder, FiBookmark } from "react-icons/fi";

function CitationCard({ citation, onClick }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const isWeb = citation.type === "web" || citation.type === "university_website";
    const category = citation.category || citation.metadata?.category || "";
    const department = citation.department || citation.metadata?.department || "";
    const section = citation.section || citation.metadata?.section || "";
    const pages = citation.page || citation.metadata?.pageNumber || "1";
    const pagesText = String(pages).includes(",") ? `Pages ${pages}` : `Page ${pages}`;
    const snippet = citation.snippet || citation.metadata?.snippet || "";
    const targetUrl = citation.downloadUrl || (isWeb ? citation.reference : null);

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    };

    const handleOpenDoc = (e) => {
        e.stopPropagation();
        if (onClick) {
            onClick(citation);
        } else if (targetUrl) {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div 
            className={`edu-chat-citation-card ${isExpanded ? "is-expanded" : ""}`}
            onClick={() => setIsExpanded(prev => !prev)}
        >
            <div className="edu-chat-citation-header">
                <span className={`edu-chat-citation-icon ${isWeb ? "is-web" : "is-doc"}`}>
                    {isWeb ? <FiGlobe /> : <FiFileText />}
                </span>

                <div className="edu-chat-citation-main-info">
                    <strong className="citation-title" title={citation.title}>
                        {citation.title || "Institutional Document"}
                    </strong>
                    
                    <div className="citation-submeta">
                        {!isWeb && (
                            <span className="citation-page-section">
                                <span className="citation-page-badge">{pagesText}</span>
                                {section && <span className="citation-section-badge">· {section}</span>}
                            </span>
                        )}
                        {isWeb && (
                            <span className="citation-web-url" title={citation.reference}>
                                {citation.reference || "Official Web Source"}
                            </span>
                        )}
                    </div>
                </div>

                <div className="edu-chat-citation-header-right">
                    {citation.similarity !== undefined && (
                        <span className="edu-chat-citation-score" title="Relevance Score">
                            {citation.similarity}% match
                        </span>
                    )}
                    <button 
                        type="button" 
                        className="citation-expand-btn"
                        onClick={handleToggleExpand}
                        aria-label={isExpanded ? "Collapse source details" : "Expand source details"}
                    >
                        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                </div>
            </div>

            {/* Badges row */}
            <div className="edu-chat-citation-badges">
                {category && (
                    <span className="citation-badge category-badge">
                        <FiFolder size={11} style={{ marginRight: 3 }} />
                        {category}
                    </span>
                )}
                {department && (
                    <span className="citation-badge dept-badge">
                        <FiBookmark size={11} style={{ marginRight: 3 }} />
                        {department}
                    </span>
                )}
            </div>

            {/* Expandable Preview Section & Highlighted Excerpt */}
            {isExpanded && (
                <div className="edu-chat-citation-expanded-body" onClick={(e) => e.stopPropagation()}>
                    {snippet && (
                        <div className="citation-snippet-box">
                            <span className="citation-snippet-label">Highlighted Excerpt:</span>
                            <blockquote className="citation-snippet-text">
                                "{snippet}"
                            </blockquote>
                        </div>
                    )}

                    <div className="citation-expanded-actions">
                        {targetUrl ? (
                            <button
                                type="button"
                                className="citation-preview-link-btn"
                                onClick={handleOpenDoc}
                            >
                                <FiExternalLink size={13} style={{ marginRight: 5 }} />
                                {isWeb ? "Visit Webpage" : "Open Source Document Preview"}
                            </button>
                        ) : (
                            <span className="citation-meta-note">
                                Verified institutional source · {pagesText}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CitationCard;