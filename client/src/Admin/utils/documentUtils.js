export const getDocumentUrl = (file) => file.signedUrl || file.url || file.fileUrl || file.storageUrl || "";

export const getStatusLabel = (file) => file.processingStatus || file.embeddingStatus || "queued";

export const normalizeStatus = (file) => {
    const status = getStatusLabel(file);

    if (status === "queued") return "uploaded";
    if (status === "pending") return "processing";
    if (status === "embedding") return "embedding";
    if (status === "ready") return "ready";
    return status;
};

export const getFileType = (file) => {
    const source = file.originalName || file.title || "";
    const extension = source.split(".").pop();

    if (!extension || extension === source) {
        return (file.mimeType || "file").split("/").pop().toUpperCase();
    }

    return extension.toUpperCase();
};
