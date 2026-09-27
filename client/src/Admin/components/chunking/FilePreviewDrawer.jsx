import React, { useState, useEffect } from "react";
import {
    X,
    FileText,
    Eye,
    Layers,
    RotateCcw,
    Database,
    Trash2,
    Calendar,
    HardDrive,
    Tag,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Download,
    ExternalLink,
    FileCode,
    FileType
} from "lucide-react";
import { getStorageFilePreview } from "../../../services/adminService";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatData";

/**
 * FilePreviewDrawer — Slide-over preview drawer for documents & files
 * 
 * Features:
 * - PDF page count, metadata, chunking and vector indexing states
 * - Markdown / TXT syntax formatted text viewer
 * - Image zoom / preview
 * - Quick triggers for Chunking, Vector Reindex, and Chunk Inspection
 */
export default function FilePreviewDrawer({
    isOpen,
    onClose,
    file,
    onViewChunks,
    onRechunk,
    onReindexQdrant,
    onDelete
}) {
    const [previewData, setPreviewData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const filePath = file?.path || file?.storagePath || file?.name;

    useEffect(() => {
        if (!isOpen || !filePath) {
            setPreviewData(null);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        getStorageFilePreview(filePath)
            .then((res) => {
                if (!isMounted) return;
                if (res.data) {
                    setPreviewData(res.data);
                }
            })
            .catch((err) => {
                console.error("[FilePreviewDrawer] Error loading preview:", err);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, filePath]);

    if (!isOpen) return null;

    const ext = (file?.extension || previewData?.extension || "").toLowerCase();
    const isPdf = ext === ".pdf";
    const isText = [".txt", ".md", ".markdown", ".json", ".log", ".csv"].includes(ext);
    const isDocx = [".docx", ".doc"].includes(ext);
    const isImage = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext);

    const status = file?.embeddingStatus || previewData?.embeddingStatus || "unindexed";
    const isCompleted = status === "completed" || status === "indexed";

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <aside
                className="file-preview-drawer neo-dark-drawer"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Drawer Header */}
                <div className="drawer-header">
                    <div className="drawer-header-left">
                        <div className="drawer-icon-box">
                            {isPdf ? (
                                <FileText size={20} className="text-red-400" />
                            ) : isDocx ? (
                                <FileText size={20} className="text-blue-400" />
                            ) : isText ? (
                                <FileCode size={20} className="text-neon-green" />
                            ) : (
                                <FileType size={20} className="text-neon-cyan" />
                            )}
                        </div>
                        <div>
                            <h3 className="drawer-title" title={file?.name}>
                                {file?.name || "Document Preview"}
                            </h3>
                            <p className="drawer-subtitle" title={filePath}>
                                {filePath}
                            </p>
                        </div>
                    </div>

                    <div className="drawer-header-actions">
                        <button
                            type="button"
                            className="drawer-close-btn"
                            onClick={onClose}
                            title="Close Preview"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 2. Metadata Grid */}
                <div className="preview-metadata-grid">
                    <div className="meta-card">
                        <span className="meta-label">File Size</span>
                        <strong className="meta-val">{formatBytes(file?.size || previewData?.size || 0)}</strong>
                    </div>
                    <div className="meta-card">
                        <span className="meta-label">Status</span>
                        <span className={`badge-status status-${status}`}>
                            {isCompleted ? "Indexed" : status}
                        </span>
                    </div>
                    <div className="meta-card">
                        <span className="meta-label">Chunks</span>
                        <strong className="meta-val text-neon-cyan">
                            {file?.totalChunks || previewData?.totalChunks || 0}
                        </strong>
                    </div>
                    <div className="meta-card">
                        <span className="meta-label">Category</span>
                        <span className="badge-category">
                            {file?.category || previewData?.document?.category || "General"}
                        </span>
                    </div>
                </div>

                {/* 3. Preview Content Box */}
                <div className="preview-content-section scrollable-body">
                    <div className="preview-section-header">
                        <h4>Content Inspection</h4>
                        {previewData?.textPreview && (
                            <span className="preview-length-tag">
                                {previewData.textPreview.length} chars rendered
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="drawer-loading-box">
                            <div className="loading-spinner" />
                            <span>Reading file stream from local storage...</span>
                        </div>
                    ) : isText && previewData?.textPreview ? (
                        <pre className="syntax-text-preview scrollable-box">
                            {previewData.textPreview}
                        </pre>
                    ) : isPdf && previewData?.textPreview ? (
                        <div className="pdf-text-preview-box">
                            <div className="pdf-preview-banner">
                                <FileText size={16} className="text-red-400" />
                                <span>Extracted PDF Sample Text (First Pages)</span>
                            </div>
                            <pre className="pdf-parsed-text">
                                {previewData.textPreview}
                            </pre>
                        </div>
                    ) : isImage ? (
                        <div className="image-preview-container">
                            <img
                                src={`/api/documents/storage/file/preview?path=${encodeURIComponent(filePath)}`}
                                alt={file?.name}
                                className="preview-image-element"
                            />
                        </div>
                    ) : (
                        <div className="drawer-binary-notice">
                            <FileText size={42} className="text-gray" />
                            <h4>{ext.toUpperCase().replace(".", "")} Document File</h4>
                            <p>
                                File stored in local storage at <code>storage/{filePath}</code>.
                                {isCompleted
                                    ? ` This document is chunked into ${file?.totalChunks || previewData?.totalChunks || 0} chunks and indexed in Qdrant.`
                                    : " This document is pending chunking and vector embedding."}
                            </p>
                        </div>
                    )}
                </div>

                {/* 4. Drawer Footer Actions */}
                <div className="drawer-footer">
                    <button
                        type="button"
                        className="studio-btn btn-secondary"
                        onClick={() => onViewChunks && onViewChunks(file)}
                    >
                        <Layers size={14} className="text-neon-cyan" />
                        <span>Inspect Chunks</span>
                    </button>

                    <button
                        type="button"
                        className="studio-btn btn-primary"
                        onClick={() => onRechunk && onRechunk(file)}
                    >
                        <RotateCcw size={14} />
                        <span>Re-chunk Document</span>
                    </button>

                    <button
                        type="button"
                        className="studio-btn btn-danger-icon"
                        onClick={() => onDelete && onDelete(file)}
                        title="Delete Document"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </aside>
        </div>
    );
}
