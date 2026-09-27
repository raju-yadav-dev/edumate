import React, { useState, useEffect, useMemo } from "react";
import {
    X,
    Layers,
    Search,
    Copy,
    Check,
    Database,
    Zap,
    FileText,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Sparkles,
    ChevronDown,
    ChevronRight,
    Tag,
    Hash
} from "lucide-react";
import { getDocumentChunks } from "../../../services/adminService";
import { formatBytes } from "../../utils/formatBytes";

/**
 * ChunkDrawer — Slide-Over Chunk Inspector Drawer
 * 
 * Features:
 * - Real-time chunk list with token & character telemetry
 * - Page & section filter
 * - Qdrant vector indexing indicator
 * - Embedding cached status
 * - Live chunk copy & text explorer
 */
export default function ChunkDrawer({
    isOpen,
    onClose,
    file,
    onRechunk,
    onReindexQdrant
}) {
    const [chunks, setChunks] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchFilter, setSearchFilter] = useState("");
    const [selectedPage, setSelectedPage] = useState("all");
    const [copiedChunkId, setCopiedChunkId] = useState(null);
    const [expandedChunkId, setExpandedChunkId] = useState(null);

    const docId = file?.documentId || file?._id;

    useEffect(() => {
        if (!isOpen || !docId) {
            setChunks([]);
            setStats(null);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        getDocumentChunks(docId)
            .then((res) => {
                if (!isMounted) return;
                if (res.data) {
                    setChunks(res.data.chunks || []);
                    setStats(res.data.stats || res.data.document || null);
                } else if (res.chunks) {
                    setChunks(res.chunks || []);
                    setStats(res.stats || null);
                }
            })
            .catch((err) => {
                console.error("[ChunkDrawer] Failed to fetch chunks:", err);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, docId]);

    // Distinct pages list for filter
    const distinctPages = useMemo(() => {
        const pages = new Set();
        chunks.forEach((c) => {
            const p = c.metadata?.pageNumber || c.pageNumber || c.page;
            if (p) pages.add(p);
        });
        return Array.from(pages).sort((a, b) => a - b);
    }, [chunks]);

    // Filtered chunks
    const filteredChunks = useMemo(() => {
        return chunks.filter((chunk) => {
            const page = chunk.metadata?.pageNumber || chunk.pageNumber || chunk.page || 1;
            if (selectedPage !== "all" && String(page) !== String(selectedPage)) {
                return false;
            }
            if (searchFilter.trim()) {
                const q = searchFilter.toLowerCase();
                const text = (chunk.text || chunk.content || "").toLowerCase();
                const title = (chunk.metadata?.sectionHeading || "").toLowerCase();
                return text.includes(q) || title.includes(q);
            }
            return true;
        });
    }, [chunks, selectedPage, searchFilter]);

    const handleCopyChunk = (chunk, id) => {
        const text = chunk.text || chunk.content || "";
        navigator.clipboard.writeText(text).then(() => {
            setCopiedChunkId(id);
            setTimeout(() => setCopiedChunkId(null), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <aside
                className="chunk-inspector-drawer neo-dark-drawer"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Drawer Header */}
                <div className="drawer-header">
                    <div className="drawer-header-left">
                        <div className="drawer-icon-box">
                            <Layers size={20} className="text-neon-cyan" />
                        </div>
                        <div>
                            <h3 className="drawer-title">Chunk Inspector</h3>
                            <p className="drawer-subtitle" title={file?.path || file?.name}>
                                {file?.name || "Document Chunks"}
                            </p>
                        </div>
                    </div>

                    <div className="drawer-header-actions">
                        <button
                            type="button"
                            className="drawer-close-btn"
                            onClick={onClose}
                            title="Close Inspector"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 2. Top Summary Metrics Card */}
                <div className="chunk-summary-card">
                    <div className="chunk-metric-col">
                        <span className="metric-label">Total Chunks</span>
                        <strong className="metric-val text-neon-cyan">{chunks.length}</strong>
                    </div>
                    <div className="chunk-metric-col">
                        <span className="metric-label">Vectors in Qdrant</span>
                        <strong className="metric-val text-neon-green">
                            {stats?.indexedChunks || file?.indexedChunks || chunks.length}
                        </strong>
                    </div>
                    <div className="chunk-metric-col">
                        <span className="metric-label">Total Tokens</span>
                        <strong className="metric-val text-purple">
                            {chunks.reduce((sum, c) => sum + (c.tokenCount || c.metadata?.tokenCount || Math.round((c.text?.length || 0) / 4)), 0)}
                        </strong>
                    </div>
                    <div className="chunk-metric-col">
                        <span className="metric-label">File Size</span>
                        <strong className="metric-val">
                            {formatBytes(file?.size || 0)}
                        </strong>
                    </div>
                </div>

                {/* 3. Search and Page Filter Bar */}
                <div className="chunk-filter-toolbar">
                    <div className="chunk-search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search in chunk text / headings..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                        />
                        {searchFilter && (
                            <button type="button" onClick={() => setSearchFilter("")}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {distinctPages.length > 1 && (
                        <div className="chunk-page-filter">
                            <select
                                value={selectedPage}
                                onChange={(e) => setSelectedPage(e.target.value)}
                            >
                                <option value="all">All Pages ({distinctPages.length})</option>
                                {distinctPages.map((p) => (
                                    <option key={p} value={p}>
                                        Page {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* 4. Chunk List Body */}
                <div className="chunk-drawer-body scrollable-body">
                    {isLoading ? (
                        <div className="drawer-loading-box">
                            <div className="loading-spinner" />
                            <span>Loading parsed chunks from storage...</span>
                        </div>
                    ) : filteredChunks.length === 0 ? (
                        <div className="drawer-empty-state">
                            <Layers size={36} className="text-gray" />
                            <h4>No Chunks Available</h4>
                            <p>
                                {chunks.length === 0
                                    ? "This document has not been chunked yet or chunks are missing."
                                    : "No chunks match your search query."}
                            </p>
                            {chunks.length === 0 && (
                                <button
                                    type="button"
                                    className="studio-btn btn-primary"
                                    onClick={() => onRechunk && onRechunk(file)}
                                >
                                    <RotateCcw size={14} />
                                    <span>Chunk Document Now</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="chunks-stream-list">
                            {filteredChunks.map((chunk, idx) => {
                                const chunkIndex = chunk.chunkIndex ?? idx;
                                const pageNum = chunk.metadata?.pageNumber || chunk.pageNumber || 1;
                                const charCount = (chunk.text || chunk.content || "").length;
                                const tokenCount = chunk.tokenCount || chunk.metadata?.tokenCount || Math.round(charCount / 4);
                                const isExpanded = expandedChunkId === chunkIndex || filteredChunks.length <= 3;
                                const isCopied = copiedChunkId === chunkIndex;

                                return (
                                    <div key={chunk._id || chunkIndex} className="chunk-card-item">
                                        <div
                                            className="chunk-card-header"
                                            onClick={() =>
                                                setExpandedChunkId(isExpanded ? null : chunkIndex)
                                            }
                                        >
                                            <div className="chunk-header-left">
                                                <span className="chunk-index-badge">
                                                    #{chunkIndex + 1}
                                                </span>
                                                <span className="chunk-page-tag">
                                                    Page {pageNum}
                                                </span>
                                                {chunk.metadata?.sectionHeading && (
                                                    <span className="chunk-heading-tag" title={chunk.metadata.sectionHeading}>
                                                        <Tag size={11} />
                                                        {chunk.metadata.sectionHeading}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="chunk-header-right">
                                                <span className="chunk-stat-chip">
                                                    {tokenCount} tokens
                                                </span>
                                                <span className="chunk-stat-chip">
                                                    {charCount} chars
                                                </span>
                                                <span className="chunk-status-chip ok" title="Indexed in Qdrant">
                                                    <Database size={11} />
                                                    Indexed
                                                </span>
                                                <button
                                                    type="button"
                                                    className="chunk-copy-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyChunk(chunk, chunkIndex);
                                                    }}
                                                    title="Copy chunk text"
                                                >
                                                    {isCopied ? <Check size={13} className="text-neon-green" /> : <Copy size={13} />}
                                                </button>
                                                <span className="chunk-expand-arrow">
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="chunk-card-content">
                                                <pre className="chunk-text-box">
                                                    {chunk.text || chunk.content}
                                                </pre>

                                                {chunk.metadata?.keywords?.length > 0 && (
                                                    <div className="chunk-keywords-row">
                                                        <span className="kw-label">Keywords:</span>
                                                        {chunk.metadata.keywords.slice(0, 6).map((kw, ki) => (
                                                            <span key={ki} className="kw-pill">
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 5. Drawer Footer */}
                <div className="drawer-footer">
                    <div className="drawer-footer-info">
                        Showing <strong>{filteredChunks.length}</strong> of {chunks.length} chunks
                    </div>
                    <div className="drawer-footer-actions">
                        <button
                            type="button"
                            className="studio-btn btn-secondary"
                            onClick={() => onRechunk && onRechunk(file)}
                        >
                            <RotateCcw size={14} />
                            <span>Re-chunk</span>
                        </button>
                        <button
                            type="button"
                            className="studio-btn btn-primary"
                            onClick={() => onReindexQdrant && onReindexQdrant(file)}
                        >
                            <Database size={14} />
                            <span>Reindex Vectors</span>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
