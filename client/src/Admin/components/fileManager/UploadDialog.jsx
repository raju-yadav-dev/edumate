import { UploadCloud } from "lucide-react";

function UploadDialog({
    upload,
    busy,
    isDropActive,
    onDrop,
    onDragOver,
    onDragLeave,
    onFile,
    onSubmit,
    setUpload
}) {
    return (
        <form className="upload-area" onSubmit={onSubmit}>
            <label
                className={isDropActive ? "upload-dropzone active" : "upload-dropzone"}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <UploadCloud />
                <span>
                    <strong>Drag files here</strong>
                    <small>{upload.file ? upload.file.name : "PDF only, max 50 MB"}</small>
                </span>
                <input
                    hidden
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    onChange={(event) => onFile(event.target.files?.[0] || null)}
                />
            </label>

            <div className="upload-meta-grid">
                <input type="text" placeholder="Title" value={upload.title} onChange={(event) => setUpload((current) => ({ ...current, title: event.target.value }))} />
                <input type="text" placeholder="Institution" value={upload.institution} onChange={(event) => setUpload((current) => ({ ...current, institution: event.target.value }))} />
                <input type="text" placeholder="Department" value={upload.department} onChange={(event) => setUpload((current) => ({ ...current, department: event.target.value }))} />
                <input type="number" min="1" placeholder="Version" value={upload.version} onChange={(event) => setUpload((current) => ({ ...current, version: event.target.value }))} />
                <input type="text" placeholder="Tags / Notes" value={upload.notes} onChange={(event) => setUpload((current) => ({ ...current, notes: event.target.value }))} />
            </div>

            <button type="submit" className="upload-submit" disabled={busy}>
                <UploadCloud size={16} />
                Upload
            </button>
        </form>
    );
}

export default UploadDialog;
