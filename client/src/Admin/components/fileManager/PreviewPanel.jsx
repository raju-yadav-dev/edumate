import "./PreviewPanel.css";
import { useState, useEffect } from "react";
import {
    Download,
    Eye as PreviewEye,
    FileText,
    X,
    AlertTriangle,
    RefreshCw,
    FileSpreadsheet,
    FileCode,
    FileImage
} from "lucide-react";

import { formatDate } from "../../utils/formatData";
import { formatBytes } from "../../utils/formatBytes";
import {
    getDocumentUrl,
    getFileType,
    normalizeStatus,
} from "../../utils/documentUtils";

function PreviewPanel({ file, onClose, onOpen, onDownload, onRebuild }) {
    const [textContents, setTextContents] = useState("");
    const [loadingText, setLoadingText] = useState(false);

    const type = file ? getFileType(file) : "";
    const url = file ? getDocumentUrl(file) : "";
    const isImage = file && (file.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file.originalName));
    const isText = file && (type === "TXT" || type === "MD" || type === "TEXT" || type === "Markdown" || (file.originalName || "").endsWith(".txt") || (file.originalName || "").endsWith(".md"));
    const isCsv = file && (type === "CSV" || (file.originalName || "").endsWith(".csv"));
    const isDocx = file && (type === "DOCX" || type === "DOC" || (file.originalName || "").endsWith(".docx") || (file.originalName || "").endsWith(".doc"));
    const isPptx = file && (type === "PPTX" || type === "PPT" || (file.originalName || "").endsWith(".pptx") || (file.originalName || "").endsWith(".ppt"));
    const isXlsx = file && (type === "XLSX" || type === "XLS" || (file.originalName || "").endsWith(".xlsx") || (file.originalName || "").endsWith(".xls"));

    useEffect(() => {
        if (file && url && (isText || isCsv)) {
            setLoadingText(true);
            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error("Network response error");
                    return res.text();
                })
                .then((text) => {
                    setTextContents(text.slice(0, 15000));
                    setLoadingText(false);
                })
                .catch((err) => {
                    console.error("Preview fetch failed:", err);
                    setTextContents("Unable to load preview content.");
                    setLoadingText(false);
                });
        } else {
            setTextContents("");
        }
    }, [file, url, isText, isCsv]);

    if (!file) {
        return (
            <aside className="preview-panel">
                <div className="preview-empty">
                    <FileText size={60} />
                    <h3>No File Selected</h3>
                    <p>Select a document from the table to preview it.</p>
                </div>
            </aside>
        );
    }

    const status = normalizeStatus(file);

    // Spreadsheets-like CSV rendering
    const renderCsvPreview = (text) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        const tableRows = lines.slice(0, 35).map(line => {
            const cols = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === "," && !inQuotes) {
                    cols.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            cols.push(current.trim());
            return cols;
        });

        if (tableRows.length === 0) return <div className="csv-preview-empty">Empty CSV File</div>;

        const maxCols = Math.max(...tableRows.map(r => r.length));

        return (
            <div className="csv-preview-table-container">
                <table className="csv-preview-table">
                    <thead>
                        <tr>
                            <th className="csv-corner-cell"></th>
                            {Array.from({ length: maxCols }).map((_, idx) => (
                                <th key={idx} className="csv-header-cell">{String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) : "")}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                                <td className="csv-row-num-cell">{rowIdx + 1}</td>
                                {Array.from({ length: maxCols }).map((_, colIdx) => (
                                    <td key={colIdx} className="csv-data-cell">{row[colIdx] || ""}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {lines.length > 35 && <div className="csv-preview-more">Showing first 35 rows...</div>}
            </div>
        );
    };

    return (
        <aside className="preview-panel">
            {/* Header */}
            <div className="preview-head">
                <div>
                    <strong>{file.originalName}</strong>
                    <span>{type} Document</span>
                </div>
                <button
                    type="button"
                    className="preview-close"
                    onClick={onClose}
                >
                    <X size={18} />
                </button>
            </div>

            {/* Preview Surface */}
            <div className="preview-surface">
                {isImage && url ? (
                    <div className="image-preview-wrapper">
                        <img
                            src={url}
                            alt={file.originalName}
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                    </div>
                ) : isText && url ? (
                    loadingText ? (
                        <div className="preview-placeholder">Loading text preview...</div>
                    ) : (
                        <pre style={{
                            margin: 0,
                            padding: "10px",
                            fontSize: "11px",
                            color: "var(--admin-text)",
                            background: "rgba(0,0,0,0.2)",
                            overflow: "auto",
                            height: "100%",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all"
                        }}>
                            {textContents}
                        </pre>
                    )
                ) : isCsv && url ? (
                    loadingText ? (
                        <div className="preview-placeholder">Loading spreadsheet preview...</div>
                    ) : (
                        renderCsvPreview(textContents)
                    )
                ) : type === "PDF" && url ? (
                    <iframe
                        title={file.originalName}
                        src={url}
                    />
                ) : isDocx ? (
                    <div className="office-preview-card docx">
                        <FileText size={72} className="office-icon" />
                        <h3>Microsoft Word Document</h3>
                        <p>Direct browser preview is not supported for Word documents.</p>
                        <span>Size: {formatBytes(file.fileSize || file.size)}</span>
                    </div>
                ) : isXlsx ? (
                    <div className="office-preview-card xlsx">
                        <FileSpreadsheet size={72} className="office-icon" />
                        <h3>Microsoft Excel Spreadsheet</h3>
                        <p>Direct browser preview is not supported for Excel files.</p>
                        <span>Size: {formatBytes(file.fileSize || file.size)}</span>
                    </div>
                ) : isPptx ? (
                    <div className="office-preview-card pptx">
                        <FileCode size={72} className="office-icon" />
                        <h3>Microsoft PowerPoint Presentation</h3>
                        <p>Direct browser preview is not supported for PowerPoint presentations.</p>
                        <span>Size: {formatBytes(file.fileSize || file.size)}</span>
                    </div>
                ) : (
                    <div className="preview-placeholder">
                        <FileText size={60} />
                        <span>No Preview Available</span>
                    </div>
                )}
            </div>

            {/* Failed Index Review Callout */}
            {status === "failed" && (
                <div className="preview-error-panel" style={{
                    padding: "12px",
                    background: "rgba(231, 76, 60, 0.08)",
                    border: "1px solid rgba(231, 76, 60, 0.3)",
                    borderRadius: "6px",
                    margin: "12px",
                    fontSize: "12px",
                    color: "#ef5350"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", marginBottom: "4px" }}>
                        <AlertTriangle size={14} />
                        <span>Indexing Failed</span>
                    </div>
                    <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--admin-muted)" }}>
                        {file.failureReason || file.metadata?.failureReason || "An error occurred during vector generation or chunk segmentation."}
                    </p>
                    <button
                        type="button"
                        className="jobs-retry-all-btn"
                        style={{ margin: 0, padding: "6px 10px", width: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        onClick={() => onRebuild?.(file._id)}
                    >
                        <RefreshCw size={11} />
                        Retry Indexing
                    </button>
                </div>
            )}

            {/* Metadata Properties */}
            <div className="metadata-grid">
                <div className="metadata-item">
                    <small>Filename</small>
                    <strong>{file.title || file.originalName}</strong>
                </div>

                <div className="metadata-item">
                    <small>Size</small>
                    <strong>{formatBytes(file.fileSize || file.size)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Type</small>
                    <strong>{type}</strong>
                </div>

                <div className="metadata-item">
                    <small>Folder Path</small>
                    <strong>{file.category || "Root"}</strong>
                </div>

                {file.version && (
                    <div className="metadata-item">
                        <small>Version</small>
                        <strong>v{file.version}</strong>
                    </div>
                )}

                <div className="metadata-item">
                    <small>Pages</small>
                    <strong>{file.metadata?.pages || file.pages || "Unknown"}</strong>
                </div>

                {file.metadata?.hash && (
                    <div className="metadata-item">
                        <small>Content Hash</small>
                        <strong style={{ fontSize: "10px", wordBreak: "break-all" }}>{file.metadata.hash}</strong>
                    </div>
                )}

                {file.chunkCount !== undefined && (
                    <div className="metadata-item">
                        <small>Total Chunks</small>
                        <strong>{file.chunkCount} Chunks</strong>
                    </div>
                )}

                {file.embeddingCount !== undefined && (
                    <div className="metadata-item">
                        <small>Embeddings Generated</small>
                        <strong>{file.embeddingCount} Vectors</strong>
                    </div>
                )}

                {file.originalUrl && (
                    <div className="metadata-item">
                        <small>Source URL</small>
                        <a href={file.originalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--admin-gold)", wordBreak: "break-all" }}>
                            {file.originalUrl}
                        </a>
                    </div>
                )}

                <div className="metadata-item">
                    <small>Created</small>
                    <strong>{formatDate(file.createdAt)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Modified</small>
                    <strong>{formatDate(file.updatedAt || file.createdAt)}</strong>
                </div>

                <div className="metadata-item">
                    <small>Status</small>
                    <strong className={`status-${status}`}>
                        {status}
                    </strong>
                </div>
            </div>

            {/* Actions */}
            <div className="preview-actions">
                <button
                    className="primary-action"
                    onClick={() => onOpen(file)}
                >
                    <PreviewEye size={16} />
                    Open
                </button>

                <button
                    className="secondary-action"
                    onClick={() => onDownload(file)}
                >
                    <Download size={16} />
                    Download
                </button>
            </div>
        </aside>
    );
}

export default PreviewPanel;