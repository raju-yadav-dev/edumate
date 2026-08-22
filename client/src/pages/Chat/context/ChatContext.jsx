import { createContext, useState, useEffect, useCallback } from "react";
import * as api from "../services/chatService";

export const ChatContext = createContext();

const LOCAL_STORAGE_THREADS = "edumate-guest-threads";
const LOCAL_STORAGE_ACTIVE = "edumate-guest-active";

export function ChatProvider({ children }) {
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check if token exists to determine auth status
    const checkAuthStatus = useCallback(() => {
        const token = localStorage.getItem("edumate-access-token");
        setIsAuthenticated(!!token);
        return !!token;
    }, []);

    // Load suggested questions
    const loadSuggestions = useCallback(async (threadId) => {
        if (!threadId) return;
        try {
            const response = await api.getSuggestedQuestions(threadId);
            if (response.success && Array.isArray(response.data)) {
                setSuggestions(response.data);
            }
        } catch (e) {
            console.error("Error loading suggested questions:", e);
        }
    }, []);

    // Load chat history
    const loadHistory = useCallback(async (autoSelect = false) => {
        const authed = checkAuthStatus();
        if (authed) {
            try {
                setLoading(true);
                setError("");
                const response = await api.listChats();
                if (response.success && Array.isArray(response.data)) {
                    setThreads(response.data);
                    if (autoSelect && response.data.length > 0) {
                        const firstId = response.data[0]._id;
                        setActiveThreadId(firstId);
                    }
                }
            } catch (err) {
                setError(err.message || "Failed to load chat history.");
            } finally {
                setLoading(false);
            }
        } else {
            // Guest Mode: load from local storage
            try {
                const stored = localStorage.getItem(LOCAL_STORAGE_THREADS);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setThreads(parsed);
                    if (autoSelect && parsed.length > 0) {
                        const storedActive = localStorage.getItem(LOCAL_STORAGE_ACTIVE);
                        const activeId = parsed.some(t => t.id === storedActive) ? storedActive : parsed[0].id;
                        setActiveThreadId(activeId);
                    }
                }
            } catch (e) {
                console.error("Error reading guest storage:", e);
            }
        }
    }, [checkAuthStatus]);

    // Select and load specific thread
    const selectThread = useCallback(async (threadId) => {
        if (!threadId) return;
        setActiveThreadId(threadId);
        setSuggestions([]);

        const authed = checkAuthStatus();
        if (authed) {
            try {
                setLoading(true);
                setError("");
                const response = await api.getChatDetails(threadId);
                if (response.success && response.data) {
                    setMessages(response.data.messages || []);
                    void loadSuggestions(threadId);
                }
            } catch (err) {
                setError(err.message || "Failed to load chat details.");
            } finally {
                setLoading(false);
            }
        } else {
            // Guest Mode
            const thread = threads.find(t => t.id === threadId);
            if (thread) {
                setMessages(thread.messages || []);
                localStorage.setItem(LOCAL_STORAGE_ACTIVE, threadId);
            }
        }
    }, [checkAuthStatus, threads, loadSuggestions]);

    // Initialize state
    useEffect(() => {
        void loadHistory(true);
    }, [loadHistory]);

    // Create a new blank thread
    const createNewThread = useCallback(() => {
        const authed = checkAuthStatus();
        if (authed) {
            // For authenticated, we wait until the first message to create on DB,
            // but set activeThreadId to null to represent "New Chat".
            setActiveThreadId(null);
            setMessages([]);
            setSuggestions([]);
        } else {
            // For guest, create in state and save
            const newThread = {
                id: `guest-chat-${Date.now()}`,
                title: "New chat",
                messages: [],
                updatedAt: new Date().toISOString()
            };
            const updated = [newThread, ...threads];
            setThreads(updated);
            setActiveThreadId(newThread.id);
            setMessages([]);
            setSuggestions([]);
            localStorage.setItem(LOCAL_STORAGE_THREADS, JSON.stringify(updated));
            localStorage.setItem(LOCAL_STORAGE_ACTIVE, newThread.id);
        }
    }, [checkAuthStatus, threads]);

    // Send user message
    const sendMessage = useCallback(async (text) => {
        if (!text?.trim()) return;

        // Immediately update UI with user's message
        const userMsg = {
            role: "user",
            content: text.trim(),
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        const authed = checkAuthStatus();
        setLoading(true);
        setError("");

        if (authed) {
            try {
                // For "New Chat", activeThreadId is null. Pass undefined to API.
                const response = await api.askQuestion({
                    question: text.trim(),
                    conversationId: activeThreadId || undefined
                });

                if (response.success && response.data) {
                    const result = response.data;
                    const assistantMsg = {
                        role: "assistant",
                        content: result.message,
                        sources: result.sources || [],
                        confidence: result.confidence || "low",
                        createdAt: new Date().toISOString()
                    };

                    setMessages(prev => [...prev, assistantMsg]);
                    
                    // Reload history to capture newly created thread / updated title
                    await loadHistory(false);
                    setActiveThreadId(result.conversationId);
                    void loadSuggestions(result.conversationId);
                }
            } catch (err) {
                setError(err.message || "Unable to retrieve response from server.");
            } finally {
                setLoading(false);
            }
        } else {
            // Guest Mode
            try {
                // Call /ask as guest (optionalAuth parses it as guest)
                const response = await api.askQuestion({
                    question: text.trim()
                });

                if (response.success && response.data) {
                    const result = response.data;
                    const assistantMsg = {
                        role: "assistant",
                        content: result.message,
                        sources: result.sources || [],
                        confidence: result.confidence || "low",
                        createdAt: new Date().toISOString()
                    };

                    setMessages(prev => [...prev, assistantMsg]);

                    // Update local storage threads
                    const threadIndex = threads.findIndex(t => t.id === activeThreadId);
                    let updatedThreads = [...threads];

                    if (threadIndex !== -1) {
                        const thread = { ...updatedThreads[threadIndex] };
                        thread.messages = [...thread.messages, userMsg, assistantMsg];
                        if (thread.title === "New chat") {
                            thread.title = text.trim().slice(0, 40);
                        }
                        thread.updatedAt = new Date().toISOString();
                        updatedThreads[threadIndex] = thread;
                    } else {
                        // Create a fallback guest thread if none selected
                        const newId = `guest-chat-${Date.now()}`;
                        const thread = {
                            id: newId,
                            title: text.trim().slice(0, 40),
                            messages: [userMsg, assistantMsg],
                            updatedAt: new Date().toISOString()
                        };
                        updatedThreads = [thread, ...updatedThreads];
                        setActiveThreadId(newId);
                    }

                    // Sort threads by updatedAt descending
                    updatedThreads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    setThreads(updatedThreads);
                    localStorage.setItem(LOCAL_STORAGE_THREADS, JSON.stringify(updatedThreads));
                }
            } catch (err) {
                setError(err.message || "Failed to retrieve response.");
            } finally {
                setLoading(false);
            }
        }
    }, [activeThreadId, checkAuthStatus, threads, loadHistory, loadSuggestions]);

    // Rename chat
    const renameThread = useCallback(async (threadId, newTitle) => {
        if (!newTitle?.trim()) return;

        const authed = checkAuthStatus();
        if (authed) {
            try {
                setLoading(true);
                const response = await api.renameChat(threadId, newTitle.trim());
                if (response.success) {
                    setThreads(prev =>
                        prev.map(t => (t._id === threadId ? { ...t, title: newTitle.trim() } : t))
                    );
                }
            } catch (err) {
                setError(err.message || "Failed to rename thread.");
            } finally {
                setLoading(false);
            }
        } else {
            // Guest Mode
            const updated = threads.map(t => (t.id === threadId ? { ...t, title: newTitle.trim() } : t));
            setThreads(updated);
            localStorage.setItem(LOCAL_STORAGE_THREADS, JSON.stringify(updated));
        }
    }, [checkAuthStatus, threads]);

    // Delete chat
    const deleteThread = useCallback(async (threadId) => {
        const authed = checkAuthStatus();
        if (authed) {
            try {
                setLoading(true);
                const response = await api.deleteChat(threadId);
                if (response.success) {
                    const filtered = threads.filter(t => t._id !== threadId);
                    setThreads(filtered);
                    if (activeThreadId === threadId) {
                        if (filtered.length > 0) {
                            setActiveThreadId(filtered[0]._id);
                            // Load details of the new active thread
                            void selectThread(filtered[0]._id);
                        } else {
                            createNewThread();
                        }
                    }
                }
            } catch (err) {
                setError(err.message || "Failed to delete thread.");
            } finally {
                setLoading(false);
            }
        } else {
            // Guest Mode
            const filtered = threads.filter(t => t.id !== threadId);
            setThreads(filtered);
            localStorage.setItem(LOCAL_STORAGE_THREADS, JSON.stringify(filtered));
            if (activeThreadId === threadId) {
                if (filtered.length > 0) {
                    setActiveThreadId(filtered[0].id);
                    setMessages(filtered[0].messages || []);
                } else {
                    createNewThread();
                }
            }
        }
    }, [checkAuthStatus, threads, activeThreadId, selectThread, createNewThread]);

    // Regenerate response
    const regenerate = useCallback(async () => {
        if (!activeThreadId) return;

        const authed = checkAuthStatus();
        if (!authed) {
            setError("Regeneration is only available for logged-in users.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            // Delete last assistant message locally first for smooth transition
            setMessages(prev => {
                if (prev.length > 0 && prev[prev.length - 1].role === "assistant") {
                    return prev.slice(0, -1);
                }
                return prev;
            });

            const response = await api.regenerateResponse(activeThreadId);
            if (response.success && response.data) {
                const result = response.data;
                const assistantMsg = {
                    role: "assistant",
                    content: result.message,
                    sources: result.sources || [],
                    confidence: result.confidence || "low",
                    createdAt: new Date().toISOString()
                };

                setMessages(prev => [...prev, assistantMsg]);
                void loadSuggestions(activeThreadId);
            }
        } catch (err) {
            setError(err.message || "Failed to regenerate response.");
            // Reload thread details to restore state
            void selectThread(activeThreadId);
        } finally {
            setLoading(false);
        }
    }, [activeThreadId, checkAuthStatus, loadSuggestions, selectThread]);

    const clearError = () => setError("");

    return (
        <ChatContext.Provider
            value={{
                threads,
                activeThreadId,
                messages,
                suggestions,
                loading,
                error,
                isAuthenticated,
                loadHistory,
                selectThread,
                createNewThread,
                sendMessage,
                renameThread,
                deleteThread,
                regenerate,
                clearError
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}
