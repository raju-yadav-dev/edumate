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

export async function askQuestionStream({ question, conversationId, onStatus, onChunk, signal }) {
    const response = await fetch(`${CHAT_API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify({ question, conversationId, stream: true }),
        signal
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to retrieve chatbot response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalResult = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const block of lines) {
            const trimmed = block.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.type === "chunk" || data.event === "stream_token") {
                    if (onChunk) onChunk(data.content || "");
                } else if (data.type === "status" || data.event === "searching_knowledge_base" || data.event === "retrieval_completed" || data.event === "building_context" || data.event === "generating_response" || data.event === "connected") {
                    if (onStatus) onStatus(data);
                } else if (data.type === "done" || data.event === "completed") {
                    finalResult = data;
                } else if (data.type === "error" || data.event === "error") {
                    throw new Error(data.message || "Streaming error occurred.");
                }
            } catch (parseErr) {
                if (parseErr.message && !parseErr.message.includes("JSON")) {
                    throw parseErr;
                }
            }
        }
    }

    return finalResult;
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
