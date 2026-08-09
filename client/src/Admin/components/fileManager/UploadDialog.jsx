import React, { useRef } from "react";
import { UploadCloud, File, Folder, X, Trash2 } from "lucide-react";

const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

function UploadDialog({
    upload,
    uploadProgress = null,
    busy,
    isDropActive,
    onDrop,
    onDragOver,
    onDragLeave,
    onFile,
    onSubmit,
    setUpload
}) {
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const handleCancel = () => {
        setUpload({
            title: "",
            category: upload.category,
            file: null,
            files: [],
            institution: "",
            department: "",
            version: "1",
            notes: ""
        });
    };

    const handleRemoveFile = (indexToRemove) => {
        setUpload(curr => {
            const files = (curr.files || []).filter((_, idx) => idx !== indexToRemove);
            return {
                ...curr,
                files,
                file: files[0] || null
            };
        });
    };

    const filesList = upload.files && upload.files.length > 0 ? upload.files : (upload.file ? [upload.file] : []);

    // 1. Fullscreen Drag-Drop Overlay
    if (isDropActive) {
        return (
            <div 
                className="fullscreen-drag-drop-overlay active"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div className="drag-drop-container">
                    <UploadCloud size={64} className="pulse-icon" />
                    <h2>Drop Files & Folders Here</h2>
                    <p>Release to select items for upload</p>
                </div>
            </div>
        );
    }

    // 2. Normal Metadata / selected files form
    return (
        <form className="upload-area" onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="rename-folder-modal-header" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--admin-line)", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "var(--admin-gold)" }}>
                    <UploadCloud size={18} />
                    Upload Documents
                </h3>
                <button type="button" className="rename-folder-modal-close-btn" onClick={handleCancel} disabled={busy}>
                    <X size={16} />
                </button>
            </div>

            <div
                className="upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: "pointer", minHeight: "100px", flexDirection: "column", justifyContent: "center", borderStyle: "dashed" }}
            >
                <UploadCloud size={32} style={{ marginBottom: "6px" }} />
                <span style={{ textAlign: "center" }}>
                    <strong>Click to browse or drag new files here</strong>
                    <small style={{ display: "block", marginTop: "4px" }}>
                        Supports PDF, DOCX, XLSX, PPTX, TXT, MD, ZIP, and entire folders
                    </small>
                </span>
                
                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,.xml,.png,.jpg,.jpeg,.webp,.gif,.zip"
                    onChange={(event) => {
                        const fileList = Array.from(event.target.files || []);
                        onFile(fileList);
                    }}
                />

                {/* Hidden Folder Input */}
                <input
                    ref={folderInputRef}
                    hidden
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(event) => {
                        const fileList = Array.from(event.target.files || []).map(file => {
                            file.relativePath = file.webkitRelativePath || file.name;
                            return file;
                        });
                        onFile(fileList);
                    }}
                />
            </div>

            <div className="upload-source-buttons" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                    type="button"
                    className="upload-select-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--admin-line)",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer"
                    }}
                >
                    <File size={14} />
                    Add Files
                </button>
                <button
                    type="button"
                    className="upload-select-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                    }}
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--admin-line)",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer"
                    }}
                >
                    <Folder size={14} />
                    Add Folder
                </button>
            </div>

            {/* Selected files preview list */}
            {filesList.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div className="selected-files-header">Selected Files ({filesList.length})</div>
                    <div className="selected-files-list">
                        {filesList.map((file, idx) => (
                            <div key={idx} className="selected-file-item">
                                <div className="file-info">
                                    <File size={14} className="file-icon" />
                                    <span className="file-name" title={file.relativePath || file.name}>
                                        {file.relativePath || file.name}
                                    </span>
                                    <span className="file-size">{formatBytes(file.size)}</span>
                                </div>
                                <button 
                                    type="button" 
                                    className="remove-file-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFile(idx);
                                    }}
                                    title="Remove file"
                                    disabled={busy}
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="upload-meta-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--admin-muted)" }}>Institution (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Institution" 
                        value={upload.institution || ""} 
                        onChange={(event) => setUpload((current) => ({ ...current, institution: event.target.value }))} 
                        style={{ background: "#060a0f", border: "1px solid var(--admin-line)", color: "#fff" }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--admin-muted)" }}>Department (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Department" 
                        value={upload.department || ""} 
                        onChange={(event) => setUpload((current) => ({ ...current, department: event.target.value }))} 
                        style={{ background: "#060a0f", border: "1px solid var(--admin-line)", color: "#fff" }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--admin-muted)" }}>Version</label>
                    <input 
                        type="number" 
                        min="1" 
                        placeholder="Version" 
                        value={upload.version || "1"} 
                        onChange={(event) => setUpload((current) => ({ ...current, version: event.target.value }))} 
                        style={{ background: "#060a0f", border: "1px solid var(--admin-line)", color: "#fff" }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", color: "var(--admin-muted)" }}>Notes (Optional)</label>
                    <input 
                        type="text" 
                        placeholder="Tags / Notes" 
                        value={upload.notes || ""} 
                        onChange={(event) => setUpload((current) => ({ ...current, notes: event.target.value }))} 
                        style={{ background: "#060a0f", border: "1px solid var(--admin-line)", color: "#fff" }}
                    />
                </div>
            </div>
            
            {uploadProgress !== null && (
                <div className="upload-progress-container">
                    <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    <span className="upload-progress-text">{uploadProgress}% Uploading...</span>
                </div>
            )}

            <div className="upload-actions" style={{ borderTop: "1px solid var(--admin-line)", paddingTop: "12px" }}>
                <button type="button" className="upload-cancel" onClick={handleCancel} disabled={busy}>
                    Cancel
                </button>
                <button 
                    type="submit" 
                    className="upload-submit" 
                    disabled={busy || filesList.length === 0}
                    style={{
                        background: "var(--admin-gold)",
                        color: "#000",
                        fontWeight: "600",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer"
                    }}
                >
                    {busy ? "Queueing..." : "Upload to Explorer"}
                </button>
            </div>
        </form>
    );
}

export default UploadDialog;
