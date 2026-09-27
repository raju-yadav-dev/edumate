import { getApiRootUrl } from "./apiConfig";
import { getAdminAccessToken } from "./adminSession";

const API_ROOT = getApiRootUrl();
const AUTH_API_BASE_URL = `${API_ROOT}/auth`;
const DOCUMENT_API_BASE_URL = `${API_ROOT}/documents`;
const ADMIN_API_BASE_URL = `${API_ROOT}/admin`;

async function parseResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        const error = new Error(`${payload.message || fallbackMessage}${validationDetails}`);
        error.status = response.status;
        throw error;
    }

    return payload;
}

const percent = (used, total) => {
    const numericTotal = Number(total || 0);

    if (!numericTotal) {
        return 0;
    }

    return Math.min((Number(used || 0) / numericTotal) * 100, 100);
};

const normalizeStorageStats = (stats = {}) => {
    const limit = Number(stats.limitBytes || 0);

    // MongoDB connection status & normalization
    const mongoConnected = stats.mongodb?.connected ?? (stats.systemStatus?.mongodb === "connected" || (stats.mongodb && Object.keys(stats.mongodb).length > 0));
    const mongoUsed = mongoConnected ? Number(stats.mongodb?.used ?? stats.mongodbBytes ?? stats.dataBytes ?? 0) : null;
    const mongoTotal = mongoConnected ? Number(stats.mongodb?.total ?? stats.mongodbStorageSize ?? stats.mongodbTotalBytes ?? limit) : null;

    // Supabase connection status & normalization
    const supabaseConfigured = stats.supabaseConfigured !== false && stats.supabase?.configured !== false;
    const supabaseConnected = supabaseConfigured && (stats.systemStatus?.supabase === "connected" || (stats.supabase && Object.keys(stats.supabase).length > 0));
    const supabaseUsed = supabaseConnected ? Number(stats.supabase?.used ?? stats.supabaseBytes ?? stats.documentBytes ?? 0) : null;
    const supabaseQuota = supabaseConnected ? Number(stats.supabase?.quota ?? stats.supabaseQuotaBytes ?? limit) : null;

    // Qdrant connection status & normalization
    const qdrantConnected = stats.qdrant?.connected ?? (stats.systemStatus?.qdrant === "connected");
    const qdrantVectors = qdrantConnected ? Number(stats.qdrant?.vectors ?? stats.knowledgeBase?.totalChunks ?? stats.totalChunks ?? 0) : 0;
    const qdrantUsed = qdrantConnected ? qdrantVectors * 4096 : null;
    const qdrantTotal = qdrantConnected ? 512 * 1024 * 1024 : null; // 512 MB hard quota

    // Combined connection status & normalization
    const combinedConnected = mongoConnected || supabaseConnected || qdrantConnected;
    const combinedUsed = combinedConnected ? ((mongoUsed || 0) + (supabaseUsed || 0) + (qdrantUsed || 0)) : null;
    const combinedTotal = combinedConnected ? ((mongoTotal || 0) + (supabaseQuota || 0) + (qdrantTotal || 0)) : null;

    return {
        ...stats,
        mongodb: {
            connected: mongoConnected,
            total: mongoTotal,
            used: mongoUsed,
            remaining: mongoConnected ? Math.max(mongoTotal - mongoUsed, 0) : null,
            usage: mongoConnected ? percent(mongoUsed, mongoTotal) : 0,
            collections: mongoConnected ? (stats.mongodb?.collections ?? stats.mongodbCollections ?? stats.collections ?? 0) : 0,
            documents: mongoConnected ? (stats.mongodb?.documents ?? stats.mongodbObjects ?? stats.documentCount ?? 0) : 0,
            indexesSize: mongoConnected ? (stats.mongodb?.indexesSize ?? stats.mongodbIndexSize ?? 0) : null
        },
        supabase: {
            configured: supabaseConfigured,
            connected: supabaseConnected,
            bucket: stats.supabase?.bucket ?? stats.supabaseBucket ?? stats.bucket ?? "",
            files: supabaseConnected ? (stats.supabase?.files ?? stats.supabaseFiles ?? stats.documentCount ?? 0) : 0,
            used: supabaseUsed,
            remaining: supabaseConnected ? Math.max(supabaseQuota - supabaseUsed, 0) : null,
            averageFileSize: supabaseConnected ? (stats.supabase?.averageFileSize ?? stats.supabaseAverageFileSize ?? (stats.documentCount ? supabaseUsed / stats.documentCount : 0)) : null,
            largestFile: supabaseConnected ? (stats.supabase?.largestFile ?? stats.supabaseLargestFile ?? null) : null,
            quota: supabaseQuota,
            usage: supabaseConnected ? percent(supabaseUsed, supabaseQuota) : 0
        },
        qdrant: {
            connected: qdrantConnected,
            status: stats.qdrant?.status ?? (qdrantConnected ? "green" : "offline"),
            vectors: qdrantVectors,
            collection: stats.qdrant?.collection ?? "edumate",
            used: qdrantUsed,
            total: qdrantTotal,
            remaining: qdrantConnected ? Math.max(qdrantTotal - qdrantUsed, 0) : null,
            usage: qdrantConnected ? percent(qdrantUsed, qdrantTotal) : 0
        },
        combined: {
            total: combinedTotal,
            used: combinedUsed,
            remaining: combinedConnected ? Math.max(combinedTotal - combinedUsed, 0) : null,
            usage: combinedConnected ? percent(combinedUsed, combinedTotal) : 0
        },
        knowledgeBase: {
            totalDocuments: stats.documentCount ?? stats.knowledgeBase?.totalDocuments ?? 0,
            totalPages: stats.totalPages ?? stats.knowledgeBase?.totalPages ?? 0,
            totalChunks: stats.totalChunks ?? stats.knowledgeBase?.totalChunks ?? 0,
            totalEmbeddings: stats.totalEmbeddings ?? stats.knowledgeBase?.totalEmbeddings ?? 0,
            processingQueue: stats.processingQueue ?? stats.knowledgeBase?.processingQueue ?? 0,
            pendingDocuments: stats.pendingDocuments ?? stats.knowledgeBase?.pendingDocuments ?? 0,
            successfulDocuments: stats.successfulDocuments ?? stats.knowledgeBase?.successfulDocuments ?? 0,
            failedDocuments: stats.failedDocuments ?? stats.knowledgeBase?.failedDocuments ?? 0
        },
        systemStatus: {
            mongodb: mongoUsed || stats.mongodb?.connected ? "connected" : "unknown",
            supabase: stats.supabaseConfigured === false || stats.supabase?.configured === false ? "not configured" : (supabaseUsed || stats.supabase ? "connected" : "unknown"),
            groq: stats.systemStatus?.groq ?? "unknown",
            qdrant: stats.qdrant?.connected || stats.systemStatus?.qdrant === "connected" ? "connected" : "offline"
        }
    };
};

export async function getAdminStatus() {
    const response = await fetch(`${AUTH_API_BASE_URL}/admin/status`);
    return parseResponse(response, "Unable to load admin status.");
}

export async function bootstrapAdmin(data) {
    const response = await fetch(`${AUTH_API_BASE_URL}/admin/bootstrap`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    return parseResponse(response, "Unable to create admin.");
}

export async function loginAdmin(data) {
    const response = await fetch(`${AUTH_API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    return parseResponse(response, "Unable to sign in as admin.");
}

export function uploadAdminDocument({ file, title, category, institution, department, version, notes }, onProgress) {
    return new Promise((resolve, reject) => {
        const token = getAdminAccessToken();
        const formData = new FormData();

        formData.append("document", file);
        formData.append("title", title || "");
        formData.append("category", category);
        formData.append("institution", institution || "");
        formData.append("department", department || "");
        formData.append("version", version || "");
        formData.append("notes", notes || "");

        const xhr = new XMLHttpRequest();
        xhr.open("POST", DOCUMENT_API_BASE_URL);

        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        if (xhr.upload && onProgress) {
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const percentage = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentage);
                }
            });
        }

        xhr.onload = () => {
            let payload = {};
            try {
                payload = JSON.parse(xhr.responseText);
            } catch (e) {}

            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(payload);
            } else {
                const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
                const error = new Error(`${payload.message || "Unable to upload document."}${validationDetails}`);
                error.status = xhr.status;
                if (payload.errors && payload.errors.duplicateDocument) {
                    error.duplicateDocument = payload.errors.duplicateDocument;
                }
                reject(error);
            }
        };

        xhr.onerror = () => {
            reject(new Error("Network error occurred during upload."));
        };

        xhr.send(formData);
    });
}


export async function replaceAdminDocument(documentId, { file, title, category, institution, department, version, notes } = {}) {
    const token = getAdminAccessToken();
    const formData = new FormData();

    if (file) {
        formData.append("document", file);
    }

    formData.append("title", title || "");
    formData.append("category", category || "");
    formData.append("institution", institution || "");
    formData.append("department", department || "");
    formData.append("version", version || "");
    formData.append("notes", notes || "");

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}`, {
        method: "PUT",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {},
        body: formData
    });

    return parseResponse(response, "Unable to replace document.");
}

export async function rebuildAdminDocumentEmbeddings(documentId) {
    const token = getAdminAccessToken();

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/embeddings/rebuild`, {
        method: "POST",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to rebuild document embeddings.");
}

export async function listAdminDocuments(query = {}) {
    const token = getAdminAccessToken();
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.set(key, value);
        }
    });

    params.set("_t", String(Date.now())); // Cache buster

    const response = await fetch(`${DOCUMENT_API_BASE_URL}?${params.toString()}`, {
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to load documents.");
}

export async function deleteAdminDocument(documentId) {
    const token = getAdminAccessToken();

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}`, {
        method: "DELETE",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to delete document.");
}

export async function listAdminUsers({ search = "", role = "" } = {}) {
    const token = getAdminAccessToken();
    const params = new URLSearchParams();

    if (search) {
        params.set("search", search);
    }

    if (role) {
        params.set("role", role);
    }

    const response = await fetch(`${API_ROOT}/users?${params.toString()}`, {
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to load users.");
}

export async function deleteAdminUser(userId) {
    const token = getAdminAccessToken();

    const response = await fetch(`${API_ROOT}/users/${userId}`, {
        method: "DELETE",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to delete user.");
}

export async function getAdminStorageStats(force = false) {
    const token = getAdminAccessToken();

    const response = await fetch(`${ADMIN_API_BASE_URL}/storage-stats?_t=${Date.now()}${force ? "&force=true" : ""}`, {
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    const payload = await parseResponse(response, "Unable to load storage stats.");

    return {
        ...payload,
        data: normalizeStorageStats(payload.data)
    };
}

export async function renameAdminDocument(documentId, originalName) {
    const token = getAdminAccessToken();

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/rename`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ originalName })
    });

    return parseResponse(response, "Unable to rename document.");
}

export async function moveAdminDocument(documentId, category) {
    const token = getAdminAccessToken();

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/move`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ category })
    });

    return parseResponse(response, "Unable to move document.");
}

export async function copyAdminDocument(documentId, category) {
    const token = getAdminAccessToken();

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/copy`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ category })
    });

    return parseResponse(response, "Unable to copy document.");
}

export async function saveProviderApiKeys({ groqApiKey, openRouteServiceKey }) {
    const token = getAdminAccessToken();
    const groqApiKeys = String(groqApiKey || "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);

    const response = await fetch(`${ADMIN_API_BASE_URL}/settings/api-keys`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
            groqApiKeys,
            openRouteServiceApiKey: openRouteServiceKey
        })
    });

    return parseResponse(response, "Unable to save API keys.");
}

export async function bulkReindexAdminDocuments({ category, ids } = {}) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/reindex`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ category, ids })
    });
    return parseResponse(response, "Unable to run reindexing.");
}

export async function getJobsStatus() {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/jobs/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to retrieve background jobs status.");
}

export async function retryFailedDocuments() {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/retry-failed`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to retry failed files.");
}

export async function ignoreFailedDocument(documentId) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/ignore`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to ignore file.");
}

export async function restoreAdminDocument(documentId) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/restore`, {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to restore document.");
}

export async function permanentDeleteAdminDocument(documentId) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/permanent`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to permanently delete document.");
}

export async function duplicateAdminDocument(documentId) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}/duplicate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to duplicate document.");
}

export async function bulkMoveAdminDocuments(ids, category) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/bulk-move`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ids, category })
    });
    return parseResponse(response, "Unable to bulk move documents.");
}

export async function bulkCopyAdminDocuments(ids, category) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/bulk-copy`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ids, category })
    });
    return parseResponse(response, "Unable to bulk copy documents.");
}

export async function bulkDeleteAdminDocuments(ids) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/bulk-delete`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ids })
    });
    return parseResponse(response, "Unable to bulk delete documents.");
}

export async function clearAdminCache() {
    const token = getAdminAccessToken();
    const response = await fetch(`${ADMIN_API_BASE_URL}/cache/clear`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to clear cache.");
}

export async function backupAdminDatabase() {
    const token = getAdminAccessToken();
    const response = await fetch(`${ADMIN_API_BASE_URL}/backup`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to export database backup.");
}

export async function restoreAdminBackup(collections) {
    const token = getAdminAccessToken();
    const response = await fetch(`${ADMIN_API_BASE_URL}/restore`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ collections })
    });
    return parseResponse(response, "Unable to restore database backup.");
}

export async function cleanupUnusedChunks() {
    const token = getAdminAccessToken();
    const response = await fetch(`${ADMIN_API_BASE_URL}/chunks/cleanup`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to clean up vector chunks.");
}

export async function rebuildAllEmbeddings() {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/rebuild`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return parseResponse(response, "Unable to rebuild embeddings.");
}

// Mission 9.1 Folder & Placeholder
export async function createPlaceholderDocument({ name, category, department, program }) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/placeholder`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name, category, department, program })
    });
    return parseResponse(response, "Unable to create placeholder document.");
}

export async function renameAdminFolder({ oldPath, newPath }) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/folder/rename`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ oldPath, newPath })
    });
    return parseResponse(response, "Unable to rename folder.");
}

export async function deleteAdminFolder(folderPath) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/folder`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ folderPath })
    });
    return parseResponse(response, "Unable to delete folder.");
}

export async function bulkRestoreAdminDocuments(ids) {
    const token = getAdminAccessToken();
    const response = await fetch(`${DOCUMENT_API_BASE_URL}/bulk-restore`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ids })
    });
    return parseResponse(response, "Unable to restore documents.");
}

// Dedicated Chunking Server Endpoint Resolver (Mission 15.3)
export function getChunkingServerUrl() {
    const configured = import.meta.env.VITE_CHUNKING_API_URL;
    if (configured) return configured.replace(/\/$/, "");
    return "http://localhost:5001";
}

export function getChunkingSSEUrl() {
    const token = getAdminAccessToken();
    const baseUrl = getChunkingServerUrl();
    return `${baseUrl}/queue/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

export function getChunkingLogsSSEUrl() {
    const token = getAdminAccessToken();
    const baseUrl = getChunkingServerUrl();
    return `${baseUrl}/logs/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

async function requestChunkingServer(path, options = {}) {
    const token = getAdminAccessToken();
    const chunkingBase = getChunkingServerUrl();
    const targetUrl = `${chunkingBase}${path.startsWith("/") ? path : `/${path}`}`;
    
    const headers = {
        ...(options.headers || {})
    };
    if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const response = await fetch(targetUrl, { ...options, headers });
        if (response.ok) {
            return await response.json().catch(() => ({}));
        }
        // If 404 or other error on port 5001, try fallback
        throw new Error(`Server returned ${response.status}`);
    } catch (err) {
        // Fallback to primary DOCUMENT_API_BASE_URL
        const fallbackUrl = `${DOCUMENT_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
        const fallbackResponse = await fetch(fallbackUrl, { ...options, headers });
        return parseResponse(fallbackResponse, `Unable to execute ${path}`);
    }
}

// Mission 9.2 & 9.3 & 15.3 Chunking Queue
export async function getChunkingQueueStatus() {
    return requestChunkingServer("/queue/status");
}

export async function pauseChunkingQueue() {
    return requestChunkingServer("/queue/pause", { method: "POST" });
}

export async function resumeChunkingQueue() {
    return requestChunkingServer("/queue/resume", { method: "POST" });
}

export async function enqueueChunkingDocuments(documentIds, options = {}) {
    return requestChunkingServer("/queue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: documentIds, ...options })
    });
}

export async function retryFailedChunkingQueue() {
    return requestChunkingServer("/queue/retry-failed", { method: "POST" });
}

export async function pauseChunkingDocument(documentId) {
    return requestChunkingServer(`/queue/pause/${documentId}`, { method: "POST" });
}

export async function cancelChunkingDocument(documentId) {
    return requestChunkingServer(`/queue/cancel/${documentId}`, { method: "POST" });
}

export async function resumeChunkingDocument(documentId) {
    return requestChunkingServer(`/queue/resume/${documentId}`, { method: "POST" });
}

export async function retryChunkingDocument(documentId) {
    return requestChunkingServer(`/queue/retry/${documentId}`, { method: "POST" });
}

// Mission 9.5 Chunk Preview & Integrity
export async function getDocumentChunks(documentId) {
    return requestChunkingServer(`/chunks/${documentId}`);
}

export async function getIntegrityReport() {
    return requestChunkingServer("/integrity/report");
}

export async function repairAdminDocument(documentId) {
    return requestChunkingServer(`/${documentId}/repair`, { method: "POST" });
}

export async function repairAllAdminDocuments() {
    return requestChunkingServer("/integrity/repair-all", { method: "POST" });
}

// Mission 15 & 15.3: Browser Chunking Studio APIs
export async function getChunkingLogs(limit = 200) {
    return requestChunkingServer(`/queue/logs?limit=${limit}&_t=${Date.now()}`);
}

export async function clearChunkingLogs() {
    return requestChunkingServer("/queue/logs/clear", { method: "POST" });
}

export async function startChunkingWorker() {
    return requestChunkingServer("/worker/start", { method: "POST" });
}

export async function stopChunkingWorker() {
    return requestChunkingServer("/worker/stop", { method: "POST" });
}

export async function restartChunkingWorker() {
    return requestChunkingServer("/worker/restart", { method: "POST" });
}

export async function clearChunkingQueue() {
    return requestChunkingServer("/queue/clear", { method: "POST" });
}

export async function getLocalStorageTree() {
    return requestChunkingServer(`/storage/tree?_t=${Date.now()}`);
}

export async function syncLocalStorage() {
    return requestChunkingServer("/storage/scan-sync", { method: "POST" });
}

export async function getQdrantStatus() {
    return requestChunkingServer(`/qdrant/status?_t=${Date.now()}`);
}

export async function verifyQdrantVectors() {
    return requestChunkingServer("/qdrant/verify", { method: "POST" });
}

export async function deleteQdrantVectors(documentId) {
    return requestChunkingServer(`/qdrant/vectors/${documentId}`, { method: "DELETE" });
}

export async function getChunkingAnalytics() {
    return requestChunkingServer(`/chunking/analytics?_t=${Date.now()}`);
}

export async function getChunkingHealth() {
    return requestChunkingServer(`/health?_t=${Date.now()}`);
}

// Mission 15.3 Windows Explorer Style Storage APIs
export async function getStorageFilePreview(filePath) {
    return requestChunkingServer(`/storage/file/preview?path=${encodeURIComponent(filePath)}&_t=${Date.now()}`);
}

export async function createStorageFolder(folderPath) {
    return requestChunkingServer("/storage/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath })
    });
}

export async function deleteStorageFolder(folderPath) {
    return requestChunkingServer("/storage/folder", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath })
    });
}

export async function deleteStorageFile(filePath) {
    return requestChunkingServer("/storage/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath })
    });
}

export async function renameStorageItem(oldPath, newPath) {
    return requestChunkingServer("/storage/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath })
    });
}

export async function chunkStorageFolder(folderPath, force = false) {
    return requestChunkingServer("/storage/chunk/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, force })
    });
}

export async function uploadFilesToStorageFolder(files, folderPath, { onProgress, autoChunk = true } = {}) {
    const token = getAdminAccessToken();
    const baseUrl = getChunkingServerUrl();

    return new Promise((resolve, reject) => {
        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append("files", file);
        });
        formData.append("folderPath", folderPath || "");
        formData.append("autoChunk", String(autoChunk));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${baseUrl}/storage/upload`, true);

        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && typeof onProgress === "function") {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent, event.loaded, event.total);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const parsed = JSON.parse(xhr.responseText);
                    resolve(parsed);
                } catch {
                    resolve({ success: true });
                }
            } else {
                try {
                    const parsed = JSON.parse(xhr.responseText);
                    reject(new Error(parsed.message || `Upload failed with status ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            }
        };

        xhr.onerror = () => {
            reject(new Error("Network error during file upload to storage."));
        };

        xhr.send(formData);
    });
}



