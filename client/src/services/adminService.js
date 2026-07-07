const API_ROOT = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
const AUTH_API_BASE_URL = `${API_ROOT}/auth`;
const DOCUMENT_API_BASE_URL = `${API_ROOT}/documents`;
const ADMIN_API_BASE_URL = `${API_ROOT}/admin`;

async function parseResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        throw new Error(`${payload.message || fallbackMessage}${validationDetails}`);
    }

    return payload;
}

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

export async function uploadAdminDocument({ file, category, institution, department, notes }) {
    const token = localStorage.getItem("edumate-access-token");
    const formData = new FormData();

    formData.append("document", file);
    formData.append("category", category);
    formData.append("institution", institution || "");
    formData.append("department", department || "");
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

export async function listAdminDocuments({ search = "", category = "" } = {}) {
    const token = localStorage.getItem("edumate-access-token");
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
    const token = localStorage.getItem("edumate-access-token");

    const response = await fetch(`${DOCUMENT_API_BASE_URL}/${documentId}`, {
        method: "DELETE",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to delete document.");
}

export async function listAdminUsers({ search = "", role = "" } = {}) {
    const token = localStorage.getItem("edumate-access-token");
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
    const token = localStorage.getItem("edumate-access-token");

    const response = await fetch(`${API_ROOT}/users/${userId}`, {
        method: "DELETE",
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });

    return parseResponse(response, "Unable to delete user.");
}

export async function saveProviderApiKeys({ groqApiKey, openRouteServiceKey }) {
    const token = localStorage.getItem("edumate-access-token");
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
