import { getApiRootUrl } from "./apiConfig";

const API_ROOT = getApiRootUrl();
const CHAT_API_BASE_URL = `${API_ROOT}/chat`;

export async function askEduMate({ question, conversationId, signal, onChunk, latitude, longitude, userMessageId, assistantMessageId, parentId, language }) {
    const token = localStorage.getItem("edumate-access-token");
    const useStream = typeof onChunk === "function";

    const response = await fetch(`${CHAT_API_BASE_URL}/ask`, {
        method: "POST",
        signal,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
            question,
            conversationId,
            latitude,
            longitude,
            userMessageId,
            assistantMessageId,
            parentId,
            language,
            ...(useStream ? { stream: true } : {})
        })
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        const error = new Error(`${payload.message || "Unable to ask EduMate."}${validationDetails}`);
        error.status = response.status;
        throw error;
    }

    if (useStream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;

                let parsed;
                try {
                    parsed = JSON.parse(dataStr);
                } catch (e) {
                    continue;
                }
                onChunk(parsed);
            }
        }
        return;
    }

    return response.json();
}
