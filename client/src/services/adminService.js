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

    const response = await fetch(`${ADMIN_API_BASE_URL}/storage-stats${force ? "?force=true" : ""}`, {
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
