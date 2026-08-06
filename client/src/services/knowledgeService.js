import { getApiRootUrl } from "./apiConfig";
import { getAdminAccessToken } from "./adminSession";

const API_ROOT = getApiRootUrl();
const KNOWLEDGE_API_BASE_URL = `${API_ROOT}/knowledge`;

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

export async function getKnowledgeSources() {
    const response = await fetch(`${KNOWLEDGE_API_BASE_URL}/sources`, {
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Unable to retrieve knowledge sources.");
}

export async function updateKnowledgeSource(id, data) {
    const response = await fetch(`${KNOWLEDGE_API_BASE_URL}/sources/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAdminAccessToken()}`
        },
        body: JSON.stringify(data)
    });
    return parseResponse(response, "Failed to update knowledge source.");
}

export async function updateKnowledgePriorities(priorities) {
    // priorities: [{ id: "...", priority: 1 }, ...]
    const response = await fetch(`${KNOWLEDGE_API_BASE_URL}/sources/priorities`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAdminAccessToken()}`
        },
        body: JSON.stringify({ priorities })
    });
    return parseResponse(response, "Failed to update source priorities.");
}

export async function addWebsiteSource(data) {
    // data: { name: "...", url: "..." }
    const response = await fetch(`${KNOWLEDGE_API_BASE_URL}/sources/websites`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAdminAccessToken()}`
        },
        body: JSON.stringify(data)
    });
    return parseResponse(response, "Failed to add website URL.");
}

export async function deleteKnowledgeSource(id) {
    const response = await fetch(`${KNOWLEDGE_API_BASE_URL}/sources/${id}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Failed to delete knowledge source.");
}
