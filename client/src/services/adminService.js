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
    if (stats.mongodb && stats.supabase && stats.combined) {
        return stats;
    }

    const limit = Number(stats.limitBytes || 0);
    const mongoUsed = Number(stats.mongodbBytes ?? stats.dataBytes ?? 0);
    const supabaseUsed = Number(stats.supabaseBytes ?? stats.documentBytes ?? 0);
    const combinedUsed = Number(stats.usedBytes ?? mongoUsed + supabaseUsed);
    const combinedTotal = Number(stats.totalBytes ?? stats.combinedLimitBytes ?? limit);
    const supabaseQuota = Number(stats.supabaseQuotaBytes ?? limit);
    const mongoTotal = Number(stats.mongodbStorageSize ?? stats.mongodbTotalBytes ?? limit);

    return {
        ...stats,
        mongodb: {
            total: mongoTotal,
            used: mongoUsed,
            remaining: Math.max(mongoTotal - mongoUsed, 0),
            usage: percent(mongoUsed, mongoTotal),
            collections: stats.mongodbCollections || stats.collections || 0,
            documents: stats.mongodbObjects || stats.documentCount || 0,
            indexesSize: stats.mongodbIndexSize || 0,
            ...(stats.mongodb || {})
        },
        supabase: {
            bucket: stats.supabaseBucket || stats.bucket || "",
            files: stats.supabaseFiles ?? stats.documentCount ?? 0,
            used: supabaseUsed,
            remaining: Math.max(supabaseQuota - supabaseUsed, 0),
            averageFileSize: stats.supabaseAverageFileSize || (stats.documentCount ? supabaseUsed / stats.documentCount : 0),
            largestFile: stats.supabaseLargestFile || null,
            quota: supabaseQuota,
            usage: percent(supabaseUsed, supabaseQuota),
            ...(stats.supabase || {})
        },
        combined: {
            total: combinedTotal,
            used: combinedUsed,
            remaining: Math.max((stats.availableBytes ?? combinedTotal - combinedUsed), 0),
            usage: percent(combinedUsed, combinedTotal),
            ...(stats.combined || {})
        },
        knowledgeBase: {
            totalDocuments: stats.documentCount || 0,
            totalPages: stats.totalPages || 0,
            totalChunks: stats.totalChunks || 0,
            totalEmbeddings: stats.totalEmbeddings || 0,
            processingQueue: stats.processingQueue || 0,
            pendingDocuments: stats.pendingDocuments || 0,
            successfulDocuments: stats.successfulDocuments || 0,
            failedDocuments: stats.failedDocuments || 0,
            ...(stats.knowledgeBase || {})
        },
        systemStatus: {
            mongodb: mongoUsed || stats.mongodb ? "connected" : "unknown",
            supabase: stats.supabaseConfigured === false ? "not configured" : (supabaseUsed || stats.supabase ? "connected" : "unknown"),
            groq: "unknown",
            chromadb: "unknown",
            ...(stats.systemStatus || {})
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

export async function uploadAdminDocument({ file, title, category, institution, department, version, notes }) {
    const token = getAdminAccessToken();
    const formData = new FormData();

    formData.append("document", file);
    formData.append("title", title || "");
    formData.append("category", category);
    formData.append("institution", institution || "");
    formData.append("department", department || "");
    formData.append("version", version || "");
    formData.append("notes", notes || "");

    const response = await fetch(DOCUMENT_API_BASE_URL, {
        method: "POST",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {},
        body: formData
    });

    return parseResponse(response, "Unable to upload document.");
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

export async function listAdminDocuments({ search = "", category = "" } = {}) {
    const token = getAdminAccessToken();
    const params = new URLSearchParams();

    if (search) {
        params.set("search", search);
    }

    if (category) {
        params.set("category", category);
    }

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

export async function getAdminStorageStats() {
    const token = getAdminAccessToken();

    const response = await fetch(`${ADMIN_API_BASE_URL}/storage-stats`, {
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
