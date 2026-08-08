import React, { useRef } from "react";
import { UploadCloud, File, Folder } from "lucide-react";

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

    return (
        <form className="upload-area" onSubmit={onSubmit}>
            <div
                className={isDropActive ? "upload-dropzone active" : "upload-dropzone"}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: "pointer" }}
            >
                <UploadCloud size={40} style={{ marginBottom: "10px" }} />
                <span>
                    <strong>Drag files or folders here</strong>
                    <small>
                        {upload.files && upload.files.length > 0 
                            ? `${upload.files.length} item(s) selected` 
                            : "Supports PDF, Word, Excel, PowerPoint, ZIP, Images, and entire Folders"
                        }
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
                        // In webkitdirectory, the files retain relative path in file.webkitRelativePath
                        const fileList = Array.from(event.target.files || []).map(file => {
                            // Ensure relativePath is attached
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
                        background: "rgba(255,255,255,0.04)",
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
                    Choose Files
                </button>
                <button
                    type="button"
                    className="upload-select-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                    }}
                    style={{
                        background: "rgba(255,255,255,0.04)",
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
                    Choose Folder
                </button>
            </div>

            <div className="upload-meta-grid">
                <input 
                    type="text" 
                    placeholder="Institution (Optional)" 
                    value={upload.institution || ""} 
                    onChange={(event) => setUpload((current) => ({ ...current, institution: event.target.value }))} 
                />
                <input 
                    type="text" 
                    placeholder="Department (Optional)" 
                    value={upload.department || ""} 
                    onChange={(event) => setUpload((current) => ({ ...current, department: event.target.value }))} 
                />
                <input 
                    type="number" 
                    min="1" 
                    placeholder="Version" 
                    value={upload.version || "1"} 
                    onChange={(event) => setUpload((current) => ({ ...current, version: event.target.value }))} 
                />
                <input 
                    type="text" 
                    placeholder="Tags / Notes (Optional)" 
                    value={upload.notes || ""} 
                    onChange={(event) => setUpload((current) => ({ ...current, notes: event.target.value }))} 
                />
            </div>
            
            {uploadProgress !== null && (
                <div className="upload-progress-container">
                    <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    <span className="upload-progress-text">{uploadProgress}% Uploading...</span>
                </div>
            )}

            <div className="upload-actions">
                <button type="button" className="upload-cancel" onClick={handleCancel} disabled={busy}>
                    Cancel
                </button>
                <button type="submit" className="upload-submit" disabled={busy || (!upload.file && (!upload.files || upload.files.length === 0))}>
                    {busy ? "Queueing..." : "Upload to Explorer"}
                </button>
            </div>
        </form>
    );
}

export default UploadDialog;
