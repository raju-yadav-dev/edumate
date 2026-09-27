import React from "react";
import { X, GitCompare, ArrowRight, Layers, FileText } from "lucide-react";

export default function ChunkDiffModal({
    isOpen,
    document: doc,
    chunk,
    onClose
}) {
    if (!isOpen || !chunk) return null;

    const rawText = chunk.text || chunk.content || "";
    // Generate semantic preview tokens
    const words = rawText.split(/\s+/).filter(Boolean);
    const tokenCount = chunk.tokenCount || Math.round(rawText.length / 4);

    return (
        <div className="chunk-preview-backdrop" onClick={onClose}>
            <div className="chunk-diff-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="diff-modal-header">
                    <div className="diff-header-left">
                        <GitCompare size={20} className="diff-icon" />
                        <div>
                            <h3>Chunk Structure & Token Inspector</h3>
                            <span className="diff-header-sub">
                                {doc?.originalName || doc?.title} • Chunk #{chunk.chunkOrder || 1}
                            </span>
                        </div>
                    </div>
                    <button type="button" className="preview-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="diff-modal-body">
                    <div className="diff-columns-grid">
                        {/* Column 1: Chunk Raw Text */}
                        <div className="diff-col">
                            <div className="diff-col-header">
                                <span>Segmented Text Content</span>
                                <span className="diff-badge">{words.length} words</span>
                            </div>
                            <div className="diff-text-panel">
                                <pre className="diff-pre-text">{rawText}</pre>
                            </div>
                        </div>

                        {/* Column 2: Chunk Semantic Vectors & Metadata */}
                        <div className="diff-col">
                            <div className="diff-col-header">
                                <span>Indexed Metadata & Embeddings</span>
                                <span className="diff-badge">{tokenCount} tokens</span>
                            </div>
                            <div className="diff-meta-panel">
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Document ID:</span>
                                    <span className="dm-val">{doc?._id}</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Section Heading:</span>
                                    <span className="dm-val">{chunk.heading || "General"}</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Parent Heading:</span>
                                    <span className="dm-val">{chunk.parentHeading || "Root"}</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Page Number:</span>
                                    <span className="dm-val">{chunk.pageNumber || 1}</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Character Count:</span>
                                    <span className="dm-val">{rawText.length}</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Vector Dimension:</span>
                                    <span className="dm-val">768 (nomic-embed-text / bge)</span>
                                </div>
                                <div className="diff-meta-row">
                                    <span className="dm-lbl">Similarity Metric:</span>
                                    <span className="dm-val">Cosine Distance</span>
                                </div>

                                {Array.isArray(chunk.keywords) && chunk.keywords.length > 0 && (
                                    <div className="diff-meta-keywords">
                                        <span className="dm-lbl">Extracted Semantic Keywords:</span>
                                        <div className="diff-keywords-list">
                                            {chunk.keywords.map((kw, i) => (
                                                <span key={i} className="diff-kw-badge">{kw}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
