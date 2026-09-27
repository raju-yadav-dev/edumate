import React, { useState } from "react";
import {
    ChevronRight,
    HardDrive,
    Folder,
    FolderOpen,
    Copy,
    Check,
    ArrowUp,
    Terminal
} from "lucide-react";

/**
 * StorageBreadcrumb — Windows 11 Style Navigational Breadcrumb
 * 
 * Strict Breadcrumb Pattern:
 * edumate / storage / [folder] / [subfolder] ...
 */
export default function StorageBreadcrumb({
    activePath = "storage",
    onNavigate,
    itemCount = 0,
    selectedCount = 0,
    totalSizeBytes = 0
}) {
    const [copied, setCopied] = useState(false);

    // Normalize path into clean segments
    const cleanPath = String(activePath || "storage")
        .replace(/^[/\\]+/, "")
        .replace(/[/\\]+$/, "");

    const rawSegments = cleanPath === "storage" || cleanPath === "all" || !cleanPath
        ? []
        : cleanPath.split("/").filter(s => s !== "storage" && s !== "edumate");

    const fullSegments = [
        { name: "edumate", path: "storage", isProjectRoot: true },
        { name: "storage", path: "storage", isStorageRoot: true },
        ...rawSegments.map((seg, idx) => {
            const subPath = rawSegments.slice(0, idx + 1).join("/");
            return {
                name: seg,
                path: subPath,
                isProjectRoot: false,
                isStorageRoot: false
            };
        })
    ];

    const handleCopyPath = () => {
        const fullDisplayPath = `edumate/storage${rawSegments.length > 0 ? `/${rawSegments.join("/")}` : ""}`;
        navigator.clipboard.writeText(fullDisplayPath).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleGoUp = () => {
        if (rawSegments.length === 0) return;
        if (rawSegments.length === 1) {
            onNavigate("storage");
        } else {
            const parentPath = rawSegments.slice(0, -1).join("/");
            onNavigate(parentPath);
        }
    };

    const formatBytes = (bytes = 0) => {
        if (!bytes || bytes === 0) return "0 B";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    return (
        <div className="storage-breadcrumb-container">
            {/* 1. Navigate Up Button */}
            <button
                type="button"
                className={`breadcrumb-up-btn ${rawSegments.length === 0 ? "disabled" : ""}`}
                onClick={handleGoUp}
                disabled={rawSegments.length === 0}
                title="Go to parent directory"
            >
                <ArrowUp size={15} />
            </button>

            {/* 2. Interactive Breadcrumb Path */}
            <div className="breadcrumb-path-box">
                {fullSegments.map((segment, index) => {
                    const isLast = index === fullSegments.length - 1;

                    return (
                        <React.Fragment key={`${segment.path}-${index}`}>
                            {index > 0 && (
                                <ChevronRight size={13} className="breadcrumb-separator" />
                            )}
                            <button
                                type="button"
                                className={`breadcrumb-segment-btn ${isLast ? "active-segment" : ""}`}
                                onClick={() => onNavigate(segment.path)}
                                title={`Navigate to ${segment.name}`}
                            >
                                {segment.isProjectRoot ? (
                                    <HardDrive size={13} className="segment-icon text-neon-cyan" />
                                ) : isLast ? (
                                    <FolderOpen size={13} className="segment-icon text-neon-green" />
                                ) : (
                                    <Folder size={13} className="segment-icon" />
                                )}
                                <span className="segment-label">{segment.name}</span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* 3. Action Buttons & Info Counter */}
            <div className="breadcrumb-meta-tools">
                <button
                    type="button"
                    className="breadcrumb-tool-btn"
                    onClick={handleCopyPath}
                    title="Copy full directory path"
                >
                    {copied ? <Check size={13} className="text-neon-green" /> : <Copy size={13} />}
                    <span>{copied ? "Copied" : "Path"}</span>
                </button>

                <div className="breadcrumb-counter-badge">
                    {selectedCount > 0 ? (
                        <span className="selection-active">
                            <strong>{selectedCount}</strong> of {itemCount} selected
                        </span>
                    ) : (
                        <span>
                            <strong>{itemCount}</strong> items {totalSizeBytes > 0 && `(${formatBytes(totalSizeBytes)})`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
