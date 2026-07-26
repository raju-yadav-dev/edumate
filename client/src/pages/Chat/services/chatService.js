import { getApiRootUrl } from "../../../services/apiConfig";

const API_ROOT = getApiRootUrl();
const CHAT_API_BASE_URL = `${API_ROOT}/chat`;

const getAuthHeaders = () => {
    const token = localStorage.getItem("edumate-access-token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function askQuestion({ question, conversationId }) {
    const response = await fetch(`${CHAT_API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify({ question, conversationId })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Unable to retrieve chatbot response.");
    }
    return payload;
}

export async function listChats() {
    const response = await fetch(CHAT_API_BASE_URL, {
        method: "GET",
        headers: {
            ...getAuthHeaders()
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to load chat history.");
    }
    return payload;
}

export async function getChatDetails(id) {
    const response = await fetch(`${CHAT_API_BASE_URL}/${id}`, {
        method: "GET",
        headers: {
            ...getAuthHeaders()
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to retrieve chat thread details.");
    }
    return payload;
}

export async function renameChat(id, title) {
    const response = await fetch(`${CHAT_API_BASE_URL}/${id}/rename`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify({ title })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to rename chat thread.");
    }
    return payload;
}

export async function deleteChat(id) {
    const response = await fetch(`${CHAT_API_BASE_URL}/${id}`, {
        method: "DELETE",
        headers: {
            ...getAuthHeaders()
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to delete chat thread.");
    }
    return payload;
}

export async function regenerateResponse(id) {
    const response = await fetch(`${CHAT_API_BASE_URL}/${id}/regenerate`, {
        method: "POST",
        headers: {
            ...getAuthHeaders()
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to regenerate response.");
    }
    return payload;
}

export async function getSuggestedQuestions(id) {
    const response = await fetch(`${CHAT_API_BASE_URL}/${id}/suggested-questions`, {
        method: "GET",
        headers: {
            ...getAuthHeaders()
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || "Failed to fetch suggested questions.");
    }
    return payload;
}
