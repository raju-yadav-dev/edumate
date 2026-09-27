import React, { useState, useEffect } from "react";
import {
    X,
    ChevronLeft,
    ChevronRight,
    FileText,
    Hash,
    Tag,
    Layers,
    BookOpen,
    Search,
    Copy,
    Check,
    Loader2,
    AlertCircle,
    Eye
} from "lucide-react";
import { getDocumentChunks } from "../../../services/adminService";

export default function ChunkPreviewDrawer({
    isOpen,
    document: doc,
    onClose,
    onOpenDiff
}) {
    const [chunks, setChunks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeChunkIndex, setActiveChunkIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen || !doc?._id) return;
        
        const fetchChunks = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await getDocumentChunks(doc._id);
                const chunkList = res.data?.chunks || [];
                setChunks(chunkList);
                setActiveChunkIndex(0);
            } catch (err) {
                console.error("[ChunkPreviewDrawer] Error:", err);
                setError(err.message || "Failed to load document chunks.");
            } finally {
                setLoading(false);
            }
        };

        fetchChunks();
    }, [isOpen, doc?._id]);

    if (!isOpen || !doc) return null;

    const filteredChunks = chunks.filter((c, idx) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const text = String(c.text || c.content || "").toLowerCase();
        const heading = String(c.heading || c.section || "").toLowerCase();
        return text.includes(q) || heading.includes(q) || String(idx + 1).includes(q);
    });

    const activeChunk = filteredChunks[activeChunkIndex] || chunks[0] || null;

    const copyChunkText = () => {
        if (!activeChunk) return;
        const text = activeChunk.text || activeChunk.content || "";
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="chunk-preview-backdrop" onClick={onClose}>
            <div className="chunk-preview-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="preview-drawer-header">
                    <div className="preview-header-left">
                        <div className="preview-header-badge">
                            <Layers size={16} />
                            <span>Chunk Inspector</span>
                        </div>
                        <h3 className="preview-doc-title" title={doc.originalName || doc.title}>
                            {doc.originalName || doc.title || "Untitled Document"}
                        </h3>
                        <span className="preview-doc-meta">
                            Category: <strong>{doc.category || "General"}</strong> • Chunks: <strong>{chunks.length}</strong>
                        </span>
                    </div>

                    <div className="preview-header-actions">
                        {chunks.length > 0 && onOpenDiff && (
                            <button
                                type="button"
                                className="preview-header-btn"
                                onClick={() => onOpenDiff(doc, activeChunk)}
                                title="Compare chunk with neighboring chunk"
                            >
                                <BookOpen size={14} />
                                <span>Compare</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="preview-close-btn"
                            onClick={onClose}
                            title="Close drawer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="preview-loading-state">
                        <Loader2 size={32} className="spin-icon" />
                        <p>Fetching and reconstructing semantic chunks...</p>
                    </div>
                ) : error ? (
                    <div className="preview-error-state">
                        <AlertCircle size={32} />
                        <p>{error}</p>
                    </div>
                ) : chunks.length === 0 ? (
                    <div className="preview-empty-state">
                        <FileText size={36} />
                        <h4>No Chunks Available</h4>
                        <p>This document has not been chunked or indexing failed before chunks were generated.</p>
                    </div>
                ) : (
                    <div className="preview-drawer-body">
                        {/* Left Navigator Pane */}
                        <div className="preview-chunks-sidebar">
                            <div className="preview-search-box">
                                <Search size={14} />
                                <input
                                    type="text"
                                    placeholder="Filter chunks..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setActiveChunkIndex(0);
                                    }}
                                />
                            </div>

                            <div className="preview-chunks-list">
                                {filteredChunks.map((chunk, idx) => {
                                    const isActive = idx === activeChunkIndex;
                                    const page = chunk.pageNumber || chunk.page || chunk.metadata?.pageNumber || 1;
                                    const tokenCount = chunk.tokenCount || Math.round((chunk.text || chunk.content || "").length / 4);

                                    return (
                                        <div
                                            key={chunk.chunkId || chunk.id || idx}
                                            className={`chunk-nav-item ${isActive ? "active-chunk-item" : ""}`}
                                            onClick={() => setActiveChunkIndex(idx)}
                                        >
                                            <div className="chunk-nav-top">
                                                <span className="chunk-nav-number">Chunk #{idx + 1}</span>
                                                <span className="chunk-nav-page">p. {page}</span>
                                            </div>
                                            <div className="chunk-nav-heading">
                                                {chunk.heading || chunk.section || chunk.parentHeading || "General Section"}
                                            </div>
                                            <div className="chunk-nav-snippet">
                                                {(chunk.text || chunk.content || "").slice(0, 75)}...
                                            </div>
                                            <div className="chunk-nav-footer">
                                                <span>{tokenCount} tokens</span>
                                                <span>{(chunk.text || chunk.content || "").length} chars</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Detail Pane */}
                        <div className="preview-chunk-detail">
                            {activeChunk && (
                                <>
                                    {/* Pagination / Chunk selector top bar */}
                                    <div className="chunk-detail-toolbar">
                                        <div className="chunk-step-nav">
                                            <button
                                                type="button"
                                                className="chunk-step-btn"
                                                disabled={activeChunkIndex === 0}
                                                onClick={() => setActiveChunkIndex((prev) => Math.max(0, prev - 1))}
                                            >
                                                <ChevronLeft size={14} />
                                                <span>Previous</span>
                                            </button>
                                            <span className="chunk-step-indicator">
                                                Chunk {activeChunkIndex + 1} of {filteredChunks.length}
                                            </span>
                                            <button
                                                type="button"
                                                className="chunk-step-btn"
                                                disabled={activeChunkIndex >= filteredChunks.length - 1}
                                                onClick={() => setActiveChunkIndex((prev) => Math.min(filteredChunks.length - 1, prev + 1))}
                                            >
                                                <span>Next</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            className="copy-chunk-btn"
                                            onClick={copyChunkText}
                                        >
                                            {copied ? <Check size={13} style={{ color: "#10b981" }} /> : <Copy size={13} />}
                                            <span>{copied ? "Copied!" : "Copy Text"}</span>
                                        </button>
                                    </div>

                                    {/* Chunk Metadata Grid */}
                                    <div className="chunk-meta-badges-grid">
                                        <div className="chunk-meta-badge">
                                            <span className="meta-badge-label">Page</span>
                                            <span className="meta-badge-value">
                                                {activeChunk.pageNumber || activeChunk.page || activeChunk.metadata?.pageNumber || 1}
                                            </span>
                                        </div>
                                        <div className="chunk-meta-badge">
                                            <span className="meta-badge-label">Tokens</span>
                                            <span className="meta-badge-value">
                                                {activeChunk.tokenCount || Math.round((activeChunk.text || "").length / 4)}
                                            </span>
                                        </div>
                                        <div className="chunk-meta-badge">
                                            <span className="meta-badge-label">Characters</span>
                                            <span className="meta-badge-value">
                                                {(activeChunk.text || activeChunk.content || "").length}
                                            </span>
                                        </div>
                                        <div className="chunk-meta-badge">
                                            <span className="meta-badge-label">Section Hierarchy</span>
                                            <span className="meta-badge-value" title={activeChunk.parentHeading || activeChunk.heading || "Root"}>
                                                {activeChunk.parentHeading ? `${activeChunk.parentHeading} > ` : ""}{activeChunk.heading || "General"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Keywords Pill List */}
                                    {Array.isArray(activeChunk.keywords) && activeChunk.keywords.length > 0 && (
                                        <div className="chunk-keywords-row">
                                            <span className="keywords-label">
                                                <Tag size={12} />
                                                Keywords:
                                            </span>
                                            <div className="keywords-pills">
                                                {activeChunk.keywords.map((kw, i) => (
                                                    <span key={i} className="keyword-pill">
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Clean Text Box */}
                                    <div className="chunk-text-container">
                                        <div className="chunk-text-header">
                                            <span>Clean Chunk Text (Semantic Boundary)</span>
                                            <span className="chunk-id-tag">
                                                ID: {activeChunk.chunkId || activeChunk.id || `chunk-${activeChunkIndex + 1}`}
                                            </span>
                                        </div>
                                        <div className="chunk-text-box">
                                            {activeChunk.text || activeChunk.content || "(Empty chunk)"}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
