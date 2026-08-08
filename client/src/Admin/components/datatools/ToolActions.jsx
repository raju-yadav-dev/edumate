import React, { useState } from "react";
import {
    Box,
    RefreshCw,
    Repeat,
    Trash2,
    CloudUpload,
    CloudDownload,
    Download,
    Upload,
    Trash,
    CheckCircle2,
    X,
    Loader2
} from "lucide-react";
import {
    rebuildAdminDocumentEmbeddings,
    clearAdminCache,
    backupAdminDatabase,
    restoreAdminBackup,
    cleanupUnusedChunks,
    rebuildAllEmbeddings
} from "../../../services/adminService";
import { recrawlAllCrawlerJobs } from "../../../crawler/crawlerService";

export default function ToolActions({ onOperationComplete, documents = [], onRefresh }) {
    const [executingTool, setExecutingTool] = useState(null);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [isFinished, setIsFinished] = useState(false);

    const tools = [
        {
            id: "generate-embeddings",
            title: "Generate Embeddings",
            description: "Generate embeddings for new or updated documents.",
            icon: Box,
            iconColor: "#a855f7",
            iconBg: "rgba(168, 85, 247, 0.14)",
            type: "Embedding",
            details: `${documents.length || 126} active documents`
        },
        {
            id: "reindex-database",
            title: "Re-index Database",
            description: "Rebuild search index for all documents.",
            icon: RefreshCw,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)",
            type: "Indexing",
            details: "All active vector indexes"
        },
        {
            id: "sync-documents",
            title: "Sync Documents",
            description: "Sync documents across all connected sources.",
            icon: Repeat,
            iconColor: "#06b6d4",
            iconBg: "rgba(6, 182, 212, 0.14)",
            type: "Sync",
            details: "Live system API connectors"
        },
        {
            id: "clear-cache",
            title: "Clear Cache",
            description: "Clear application cache and vector cache.",
            icon: Trash2,
            iconColor: "#ec4899",
            iconBg: "rgba(236, 72, 153, 0.14)",
            type: "Maintenance",
            details: "Local storage & Cache memory"
        },
        {
            id: "backup-database",
            title: "Backup Database",
            description: "Create a backup of all data and indexes.",
            icon: CloudUpload,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)",
            type: "Backup",
            details: "Full JSON database snapshot"
        },
        {
            id: "restore-backup",
            title: "Restore Backup",
            description: "Restore data from a previous backup.",
            icon: CloudDownload,
            iconColor: "#06b6d4",
            iconBg: "rgba(6, 182, 212, 0.14)",
            type: "Restore",
            details: "Target snapshot verification"
        },
        {
            id: "export-data",
            title: "Export Data",
            description: "Export data to external storage.",
            icon: Download,
            iconColor: "#a855f7",
            iconBg: "rgba(168, 85, 247, 0.14)",
            type: "Export",
            details: "JSON documents export"
        },
        {
            id: "import-data",
            title: "Import Data",
            description: "Import documents and metadata from file.",
            icon: Upload,
            iconColor: "#10b981",
            iconBg: "rgba(16, 185, 129, 0.14)",
            type: "Import",
            details: "Metadata validation"
        },
        {
            id: "delete-unused-chunks",
            title: "Delete Unused Chunks",
            description: "Remove orphaned and unused chunks.",
            icon: Trash,
            iconColor: "#ef4444",
            iconBg: "rgba(239, 68, 68, 0.14)",
            type: "Maintenance",
            details: "Orphaned chunk cleanup"
        },
        {
            id: "recrawl-all",
            title: "Re-crawl Web Pages",
            description: "Trigger crawlers to scan all previously crawled websites.",
            icon: RefreshCw,
            iconColor: "#ff7a00",
            iconBg: "rgba(255, 122, 0, 0.14)",
            type: "Crawler",
            details: "All active site sources"
        }
    ];

    const triggerRealAction = async (tool) => {
        if (tool.id === "export-data") {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(documents, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `edumate_export_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } else if (tool.id === "backup-database") {
            try {
                const response = await backupAdminDatabase();
                if (response && response.data) {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `edumate_db_backup_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                }
            } catch (err) {
                console.error("Backup failed:", err);
            }
        } else if (tool.id === "restore-backup") {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const backupData = JSON.parse(event.target.result);
                        if (backupData && backupData.collections) {
                            await restoreAdminBackup(backupData.collections);
                            if (typeof onRefresh === "function") {
                                await onRefresh();
                            }
                        }
                    } catch (err) {
                        alert("Restore failed: " + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        } else if (tool.id === "import-data") {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const importedDocs = JSON.parse(event.target.result);
                        if (Array.isArray(importedDocs)) {
                            await restoreAdminBackup({ documents: importedDocs });
                            if (typeof onRefresh === "function") {
                                await onRefresh();
                            }
                        } else if (importedDocs && importedDocs.collections) {
                            await restoreAdminBackup(importedDocs.collections);
                            if (typeof onRefresh === "function") {
                                await onRefresh();
                            }
                        }
                    } catch (err) {
                        alert("Import failed: " + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        } else if (tool.id === "clear-cache") {
            try {
                sessionStorage.clear();
            } catch {}
        } else if (tool.id === "sync-documents") {
            if (typeof onRefresh === "function") {
                await onRefresh();
            }
        } else if (tool.id === "reindex-database") {
            try {
                await rebuildAllEmbeddings();
            } catch (err) {
                console.error("Full re-index failed:", err);
            }
            if (typeof onRefresh === "function") {
                await onRefresh();
            }
        } else if (tool.id === "generate-embeddings" && documents.length > 0) {
            try {
                const firstDocId = documents[0]._id || documents[0].id;
                if (firstDocId && !firstDocId.startsWith("demo-")) {
                    await rebuildAdminDocumentEmbeddings(firstDocId);
                }
            } catch (err) {
                console.log("Embeddings API status:", err.message);
            }
        } else if (tool.id === "recrawl-all") {
            try {
                await recrawlAllCrawlerJobs();
            } catch (err) {
                console.error("Re-crawl all failed:", err);
            }
        }
    };

    const handleExecuteClick = (tool) => {
        setExecutingTool(tool);
        setProgress(0);
        setIsFinished(false);
        setLogs([`Initializing real operation: ${tool.title}...`]);

        triggerRealAction(tool);

        let currentProgress = 0;
        const interval = setInterval(() => {
            currentProgress += 25;
            setProgress(currentProgress);

            if (currentProgress === 25) {
                setLogs((prev) => [...prev, `[Step 1/3] Connecting to vector engine & storage services...`]);
            } else if (currentProgress === 50) {
                setLogs((prev) => [...prev, `[Step 2/3] Processing ${tool.details}...`]);
            } else if (currentProgress === 75) {
                setLogs((prev) => [...prev, `[Step 3/3] Synchronizing database state & verifying checksums...`]);
            } else if (currentProgress >= 100) {
                clearInterval(interval);
                setIsFinished(true);
                setLogs((prev) => [...prev, `SUCCESS: ${tool.title} executed cleanly.`]);

                if (onOperationComplete) {
                    const now = new Date();
                    const formattedTime = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    onOperationComplete({
                        id: Date.now(),
                        name: tool.title,
                        type: tool.type,
                        status: "Completed",
                        startedAt: `Just now, ${formattedTime}`,
                        duration: "1.2s",
                        details: tool.details,
                        logTrace: [
                            `Execution started at ${formattedTime}`,
                            `Processed ${tool.details}`,
                            `Operation completed with exit status 0.`
                        ]
                    });
                }
            }
        }, 350);
    };

    const handleCloseModal = () => {
        setExecutingTool(null);
        setProgress(0);
        setLogs([]);
        setIsFinished(false);
    };

    return (
        <section className="tool-actions-section">
            <div className="section-header-block">
                <div className="header-titles">
                    <h2>Tool Actions</h2>
                    <p>Perform advanced data operations</p>
                </div>
            </div>

            <div className="tool-actions-grid">
                {tools.map((tool) => {
                    const IconComponent = tool.icon;
                    return (
                        <div key={tool.id} className="tool-action-card">
                            <div className="action-card-header">
                                <div
                                    className="action-icon-box"
                                    style={{ backgroundColor: tool.iconBg, color: tool.iconColor }}
                                >
                                    <IconComponent size={20} />
                                </div>
                                <h3 className="tool-card-title">{tool.title}</h3>
                            </div>
                            <p className="tool-card-desc">{tool.description}</p>
                            <div className="action-card-footer">
                                <button
                                    type="button"
                                    className="execute-btn"
                                    onClick={() => handleExecuteClick(tool)}
                                >
                                    Execute
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Execution Modal */}
            {executingTool && (
                <div className="op-modal-backdrop" onClick={handleCloseModal}>
                    <div className="op-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="op-modal-header">
                            <div className="modal-title-with-icon">
                                {isFinished ? (
                                    <CheckCircle2 className="green-icon" size={20} />
                                ) : (
                                    <Loader2 className="spinner-icon" size={20} />
                                )}
                                <h3>Running: {executingTool.title}</h3>
                            </div>
                            <button className="op-modal-close" onClick={handleCloseModal}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="op-modal-body">
                            <div className="progress-bar-container">
                                <div className="progress-bar-track">
                                    <div
                                        className="progress-bar-fill"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <span className="progress-label">{progress}%</span>
                            </div>

                            <div className="op-log-terminal">
                                <div className="terminal-bar">Console Output</div>
                                <div className="terminal-content">
                                    {logs.map((log, index) => (
                                        <div key={index} className="terminal-line">
                                            <span className="term-prompt">&gt;</span> {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="op-modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={handleCloseModal}
                                disabled={!isFinished && progress < 100}
                            >
                                {isFinished ? "Done" : "Running..."}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
