import { getApiRootUrl } from "./apiConfig";

const API_ROOT = getApiRootUrl();
const CHAT_API_BASE_URL = `${API_ROOT}/chat`;

export async function askEduMate({ question, conversationId, signal }) {
    const token = localStorage.getItem("edumate-access-token");

    const response = await fetch(`${CHAT_API_BASE_URL}/ask`, {
        method: "POST",
        signal,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
            question,
            conversationId
        })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        throw new Error(`${payload.message || "Unable to ask EduMate."}${validationDetails}`);
    }

    return payload;
}
