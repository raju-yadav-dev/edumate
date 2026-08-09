import React, { useMemo } from "react";
import { X, File, Folder, HardDrive, Info } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatData";
import { getFileType } from "../../utils/documentUtils";
import "./PropertiesModal.css";

function PropertiesModal({ item, onClose, folders = [], documents = [] }) {
    if (!item) return null;

    const isFolder = item.isFolder || !!item.value; // check if folder

    // Calculate folder stats recursively
    const folderStats = useMemo(() => {
        if (!isFolder) return null;

        const folderVal = item.value;
        const visited = new Set();
        
        const getDescendants = (val) => {
            if (visited.has(val)) return [];
            visited.add(val);
            let desc = [val];
            const children = folders.filter(f => f.parent === val);
            children.forEach(child => {
                desc = [...desc, ...getDescendants(child.value)];
            });
            return desc;
        };

        const descendants = getDescendants(folderVal);
        const subfoldersCount = descendants.length - 1; // exclude self

        // Find all documents whose category matches any of these descendant folders
        const childFiles = documents.filter(doc => descendants.includes(doc.category));
        const totalSize = childFiles.reduce((sum, doc) => sum + (doc.fileSize || doc.size || 0), 0);
        const filesCount = childFiles.length;

        // Parent location path
        const parentParts = [];
        let curr = folders.find(f => f.value === folderVal);
        while (curr && curr.parent) {
            const p = folders.find(f => f.value === curr.parent);
            if (p) {
                parentParts.unshift(p.label);
                curr = p;
            } else {
                break;
            }
        }
        const locationPath = "Root" + (parentParts.length > 0 ? " / " + parentParts.join(" / ") : "");

        return {
            subfoldersCount,
            filesCount,
            totalSize,
            locationPath
        };
    }, [isFolder, item, folders, documents]);

    // Calculate file stats
    const fileStats = useMemo(() => {
        if (isFolder) return null;

        const file = item;
        const type = getFileType(file);
        const categoryVal = file.category;

        // Path location
        const pathParts = [];
        let curr = folders.find(f => f.value === categoryVal);
        while (curr) {
            pathParts.unshift(curr.label);
            curr = curr.parent ? folders.find(f => f.value === curr.parent) : null;
        }
        const locationPath = "Root" + (pathParts.length > 0 ? " / " + pathParts.join(" / ") : "");

        return {
            type,
            locationPath
        };
    }, [isFolder, item, folders]);

    return (
        <div className="properties-modal-overlay" onClick={onClose}>
            <div className="properties-modal-card" onClick={(e) => e.stopPropagation()}>
                <header className="properties-modal-header">
                    <div className="properties-title">
                        <Info size={18} className="title-icon" />
                        <h3>Properties</h3>
                    </div>
                    <button type="button" className="properties-close-btn" onClick={onClose} aria-label="Close properties dialog">
                        <X size={18} />
                    </button>
                </header>

                <div className="properties-modal-body">
                    {isFolder ? (
                        <>
                            <div className="properties-hero">
                                <Folder size={48} className="hero-icon folder" />
                                <div>
                                    <h4>{item.label}</h4>
                                    <span>Folder</span>
                                </div>
                            </div>

                            <div className="properties-details">
                                <div className="detail-row">
                                    <span className="detail-label">Type:</span>
                                    <span className="detail-value">File Folder</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Location:</span>
                                    <span className="detail-value">{folderStats?.locationPath}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Size:</span>
                                    <span className="detail-value">
                                        <strong>{formatBytes(folderStats?.totalSize)}</strong> ({folderStats?.totalSize.toLocaleString()} bytes)
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Contains:</span>
                                    <span className="detail-value">
                                        {folderStats?.filesCount} Files, {folderStats?.subfoldersCount} Folders
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Folder ID / Category:</span>
                                    <span className="detail-value-code">{item.value}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="properties-hero">
                                <File size={48} className="hero-icon file" />
                                <div>
                                    <h4>{item.originalName}</h4>
                                    <span>{fileStats?.type} File</span>
                                </div>
                            </div>

                            <div className="properties-details">
                                <div className="detail-row">
                                    <span className="detail-label">Type of file:</span>
                                    <span className="detail-value">{item.mimeType} ({fileStats?.type})</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Size:</span>
                                    <span className="detail-value">
                                        <strong>{formatBytes(item.fileSize || item.size)}</strong> ({(item.fileSize || item.size || 0).toLocaleString()} bytes)
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Location:</span>
                                    <span className="detail-value">{fileStats?.locationPath}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Created:</span>
                                    <span className="detail-value">{formatDate(item.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Modified:</span>
                                    <span className="detail-value">{formatDate(item.updatedAt || item.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Uploaded By:</span>
                                    <span className="detail-value">
                                        {item.createdBy?.fullName || item.uploadedBy?.fullName || "Admin"}
                                    </span>
                                </div>
                                <div className="detail-divider" />
                                <div className="detail-row">
                                    <span className="detail-label">Index Status:</span>
                                    <span className={`detail-value status-${item.embeddingStatus}`}>
                                        {item.embeddingStatus || "pending"}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Chunk Count:</span>
                                    <span className="detail-value">{item.chunkCount !== undefined ? `${item.chunkCount} chunks` : "N/A"}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Last Indexed:</span>
                                    <span className="detail-value">{item.embeddingStatus === "indexed" ? formatDate(item.updatedAt) : "N/A"}</span>
                                </div>
                                {(item.originalUrl || item.metadata?.sourceUrl || item.sourceUrl) && (
                                    <div className="detail-row">
                                        <span className="detail-label">Source URL:</span>
                                        <span className="detail-value-link">
                                            <a href={item.originalUrl || item.metadata?.sourceUrl || item.sourceUrl} target="_blank" rel="noopener noreferrer">
                                                {item.originalUrl || item.metadata?.sourceUrl || item.sourceUrl}
                                            </a>
                                        </span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">Storage Location:</span>
                                    <span className="detail-value-code">{item.metadata?.uploadedFrom === "crawler" ? `[edumate-crawler] ${item.storagePath}` : item.storagePath}</span>
                                </div>
                                {item.metadata?.uploadedFrom === "crawler" && (
                                    <div className="detail-row">
                                        <span className="detail-label">Source Type:</span>
                                        <span className="detail-value" style={{ color: "var(--admin-gold)", fontWeight: "600" }}>🌐 Crawled Web Resource</span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">SHA-256 Hash:</span>
                                    <span className="detail-value-code" style={{ fontSize: "10px" }}>{item.checksum || item.contentHash || item.metadata?.hash || "N/A"}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <footer className="properties-modal-footer">
                    <button type="button" className="properties-btn-ok" onClick={onClose}>
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default PropertiesModal;
