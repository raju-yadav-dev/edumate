import "./Chat.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { askEduMate } from "../../services/chatService";
import useAuth from "../../hooks/useAuth";
import useTheme from "../../hooks/useTheme";
import Sidebar from "../../components/Chat/Sidebar";
import TopBar from "../../components/Chat/TopBar";
import MessageBubble from "../../components/Chat/MessageBubble";
import SuggestionCards from "../../components/Chat/SuggestionCards";
import TypingIndicator from "../../components/Chat/TypingIndicator";
import ChatInput from "../../components/Chat/ChatInput";
import ThemeControls from "../../components/Chat/ThemeControls";
import useVoice from "../../hooks/useVoice";
import VoiceUIComponent from "../../components/Voice/VoiceUIComponent";
import VoiceConversationManager from "../../services/voice/VoiceConversationManager";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";

const CHAT_STORAGE_KEY = "edumate-chat-threads";
const CHAT_ACTIVE_KEY = "edumate-chat-active";

const normalizeThreadMessages = (messages, threadId) => {
    if (!messages) return { normalized: [], updated: false };
    
    let needsNormalization = false;
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].id === undefined) {
            needsNormalization = true;
            break;
        }
        if (i > 0 && messages[i].parentId === undefined) {
            needsNormalization = true;
            break;
        }
    }
    
    if (!needsNormalization) {
        return { normalized: messages, updated: false };
    }
    
    const normalized = messages.map((msg, idx) => {
        const id = msg.id || `msg-legacy-${idx}-${threadId}`;
        let parentId = msg.parentId;
        if (idx > 0 && !parentId) {
            parentId = messages[idx - 1].id || `msg-legacy-${idx - 1}-${threadId}`;
        }
        return {
            ...msg,
            id,
            parentId: parentId || null
        };
    });
    
    return { normalized, updated: true };
};

function safeId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function formatThreadLabel(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric"
    }).format(date);
}

function buildAssistantSources() {
    return [
        { title: "Admission.pdf", page: "4", section: "Fee structure", similarity: 97 },
        { title: "Campus-Guide.pdf", page: "12", section: "Student services", similarity: 93 }
    ];
}

function createSampleThreads() {
    const firstMessageId = safeId("msg");

    return [
        {
            id: "thread-admissions",
            title: "Admission checklist",
            preview: "Required documents, steps, and deadlines.",
            updatedLabel: "Today",
            bucket: "Today",
            pinned: true,
            archived: false,
            hasFiles: true,
            messages: [
                {
                    id: firstMessageId,
                    role: "user",
                    content: "I need the admission checklist for the BCA program.",
                    timestamp: "9:14 AM"
                },
                {
                    id: safeId("msg"),
                    role: "assistant",
                    content: "Here is a concise admission checklist:\n\n1. Verify eligibility and course intake.\n2. Keep your marksheets, identity proof, and recent photographs ready.\n3. Review the fee structure and reservation rules.\n4. Submit the online form and follow up with the admissions office.\n\n| Document | Notes |\n| --- | --- |\n| Marksheets | Last qualifying exam |\n| ID proof | Aadhaar / Passport / Voter ID |\n| Photo | Recent passport size |\n\nFor most applicants, I recommend preparing a single PDF folder before starting the form.",
                    timestamp: "9:15 AM",
                    confidence: "high",
                    sources: buildAssistantSources(),
                    reaction: "like"
                }
            ]
        },
        {
            id: "thread-hostel",
            title: "Hostel comparison",
            preview: "Comparing hostel facilities and commute time.",
            updatedLabel: "Yesterday",
            bucket: "Yesterday",
            pinned: false,
            archived: false,
            hasFiles: false,
            messages: [
                {
                    id: safeId("msg"),
                    role: "user",
                    content: "Which hostel is better for first-year students?",
                    timestamp: "6:22 PM"
                },
                {
                    id: safeId("msg"),
                    role: "assistant",
                    content: "The better hostel is usually the one that balances proximity, safety, and study time.\n\n- Pick the option closest to the academic block if you commute often.\n- Choose the hostel with stable internet and quiet study hours if you rely on digital learning.\n- Review meal timings and weekend access before deciding.\n\nIf you want, I can compare both options side by side.",
                    timestamp: "6:23 PM",
                    confidence: "medium",
                    sources: [
                        { title: "Hostel-Rules.pdf", page: "2", section: "Eligibility", similarity: 88 }
                    ]
                }
            ]
        },
        {
            id: "thread-scholarship",
            title: "Scholarship plan",
            preview: "Scholarship eligibility and application tips.",
            updatedLabel: "Previous week",
            bucket: "Previous Week",
            pinned: false,
            archived: false,
            hasFiles: false,
            messages: [
                {
                    id: safeId("msg"),
                    role: "assistant",
                    content: "Scholarships typically fall into three groups: merit-based, need-based, and government-backed support.\n\n- Confirm the eligibility window first.\n- Prepare income certificates and academic records early.\n- Track the submission deadline carefully because many portals close at midnight.",
                    timestamp: "Mon",
                    confidence: "high",
                    sources: [
                        { title: "Scholarship.pdf", page: "8", section: "Eligibility matrix", similarity: 95 }
                    ]
                }
            ]
        },
        {
            id: "thread-archive",
            title: "Exam notice archive",
            preview: "Archived query for academic notices.",
            updatedLabel: "Archive",
            bucket: "Archive",
            pinned: false,
            archived: true,
            hasFiles: false,
            messages: []
        }
    ];
}

function readStoredThreads() {
    if (typeof window === "undefined") {
        return createSampleThreads();
    }

    const stored = localStorage.getItem(CHAT_STORAGE_KEY);

    if (!stored) {
        return createSampleThreads();
    }

    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length ? parsed : createSampleThreads();
    } catch {
        return createSampleThreads();
    }
}

function readStoredActiveThread(threads) {
    if (typeof window === "undefined") {
        return threads[0]?.id || null;
    }

    const stored = localStorage.getItem(CHAT_ACTIVE_KEY);

    if (stored && threads.some((thread) => thread.id === stored)) {
        return stored;
    }

    const blankThread = threads.find((thread) => thread.messages.length === 0);

    return blankThread?.id || threads[0]?.id || null;
}

function createBlankThread() {
    const now = new Date();

    return {
        id: safeId("chat"),
        title: "New chat",
        preview: "Start a conversation with EduMate.",
        updatedLabel: formatThreadLabel(now),
        bucket: "Today",
        pinned: false,
        archived: false,
        hasFiles: false,
        messages: []
    };
}

function downloadTextFile(filename, content, mimeType = "text/markdown;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

function Chat() {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { isAuthenticated, user, logout } = useAuth();
    const {
        voiceState,
        transcript,
        elapsedSeconds,
        activeLang,
        isMuted,
        isContinuousMode,
        startSingleQuery,
        startContinuousConversation,
        startListening,
        stopListening,
        stopResponse,
        stopConversation,
        toggleMute,
        setLanguage,
        replayResponse,
        userInterruption
    } = useVoice();
    const initialPrompt = useMemo(() => new URLSearchParams(location.search).get("q") || "", [location.search]);
    const [threads, setThreads] = useState(() => readStoredThreads());
    const [activeThreadId, setActiveThreadId] = useState(() => readStoredActiveThread(readStoredThreads()));
    const [input, setInput] = useState(initialPrompt);
    const [chatSearch, setChatSearch] = useState("");
    const [messageSearch, setMessageSearch] = useState("");
    const [attachments, setAttachments] = useState([]);

    const [activeChildMap, setActiveChildMap] = useState({});
    const [streamingText, setStreamingText] = useState("");
    const [streamingMessageId, setStreamingMessageId] = useState(null);

    useKeyboardShortcuts({
        "ctrl+f": (e) => {
            const searchField = document.querySelector("input[placeholder*='Search'], .edu-topbar-search-box input");
            if (searchField) searchField.focus();
        },
        "escape": () => {
            setMessageSearch("");
            setChatSearch("");
        }
    });
    
    // Register UI navigation and local injection handlers for Voice commands
    useEffect(() => {
        VoiceConversationManager.registerHandlers({
            navigate: navigate,
            openSidebar: () => setSidebarCollapsed(false),
            insertLocalMessage: (userText, assistantText, mapData = null) => {
                const now = new Date();
                const userMsg = {
                    id: safeId("msg"),
                    role: "user",
                    content: userText,
                    timestamp: formatTimestamp(now)
                };
                const assistantMsg = {
                    id: safeId("msg"),
                    role: "assistant",
                    content: assistantText,
                    timestamp: formatTimestamp(new Date()),
                    confidence: "high",
                    sources: [],
                    mapData: mapData
                };

                setThreads((currentThreads) => currentThreads.map((thread) => {
                    const targetId = activeThreadId || thread.id;
                    if (thread.id !== targetId) return thread;
                    return {
                        ...thread,
                        messages: [...thread.messages, userMsg, assistantMsg]
                    };
                }));
            }
        });
    }, [activeThreadId, navigate, setThreads]);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
    const [hasSubmittedInitialPrompt, setHasSubmittedInitialPrompt] = useState(false);
    const abortRef = useRef(null);
    const bottomRef = useRef(null);
    const [gpsCoords, setGpsCoords] = useState(null);

    useEffect(() => {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads));
    }, [threads]);

    useEffect(() => {
        if (activeThreadId) {
            localStorage.setItem(CHAT_ACTIVE_KEY, activeThreadId);
        }
    }, [activeThreadId]);

    useEffect(() => {
        const activeT = threads.find((t) => t.id === activeThreadId);
        setConversationId(activeT?.serverConversationId || null);
    }, [activeThreadId, threads]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) || threads[0], [threads, activeThreadId]);

    // Reconstruct branching active path
    useEffect(() => {
        if (!activeThread?.messages) return;

        const { normalized, updated } = normalizeThreadMessages(activeThread.messages, activeThread.id);
        if (updated) {
            setThreads((prevThreads) => prevThreads.map((t) => t.id === activeThread.id ? { ...t, messages: normalized } : t));
            return;
        }

        setActiveChildMap((prevMap) => {
            const map = { ...prevMap };
            let changed = false;

            const parentToChildren = {};
            normalized.forEach(msg => {
                const pId = msg.parentId || "root";
                if (!parentToChildren[pId]) parentToChildren[pId] = [];
                parentToChildren[pId].push(msg);
            });

            Object.keys(parentToChildren).forEach(pId => {
                const children = parentToChildren[pId];
                if (children.length > 0) {
                    if (!map[pId] || !children.some(c => c.id === map[pId])) {
                        map[pId] = children[children.length - 1].id;
                        changed = true;
                    }
                }
            });

            return changed ? map : prevMap;
        });
    }, [activeThreadId, activeThread?.messages]);

    const activeBranchMessages = useMemo(() => {
        if (!activeThread?.messages?.length) return [];
        
        const messageMap = {};
        const parentToChildren = {};
        
        activeThread.messages.forEach(msg => {
            messageMap[msg.id] = msg;
            const pId = msg.parentId || "root";
            if (!parentToChildren[pId]) parentToChildren[pId] = [];
            parentToChildren[pId].push(msg);
        });
        
        const branch = [];
        let currentId = activeChildMap["root"];
        if (!currentId || !messageMap[currentId]) {
            const roots = parentToChildren["root"] || [];
            currentId = roots[roots.length - 1]?.id || null;
        }
        
        const visited = new Set();
        while (currentId && messageMap[currentId] && !visited.has(currentId)) {
            visited.add(currentId);
            const msg = messageMap[currentId];
            branch.push(msg);
            
            const children = parentToChildren[currentId] || [];
            if (children.length === 0) break;
            
            if (activeChildMap[currentId] && messageMap[activeChildMap[currentId]]) {
                currentId = activeChildMap[currentId];
            } else {
                currentId = children[children.length - 1].id;
            }
        }
        
        return branch;
    }, [activeThread?.messages, activeChildMap]);

    const sendMessage = useCallback(async (question, overrideCoords = null, parentId = null, userMessageId = null, assistantMessageId = null, displayText = null) => {
        let currentThreadId = activeThreadId;
        const trimmedQuestion = question.trim();
        const displayQuestion = displayText ? displayText.trim() : trimmedQuestion;
        let finalText = "";

        if ((!trimmedQuestion && attachments.length === 0) || loading) {
            return;
        }

        setLoading(true);
        setInput("");
        setStreamingText("");

        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        const now = new Date();
        const uMsgId = userMessageId || safeId("msg");
        const aMsgId = assistantMessageId || safeId("msg");

        let finalParentId = parentId;
        if (!finalParentId && activeBranchMessages.length > 0) {
            finalParentId = activeBranchMessages[activeBranchMessages.length - 1].id;
        }

        const userMessage = {
            id: uMsgId,
            parentId: finalParentId,
            role: "user",
            content: displayQuestion || (attachments.length ? `[Attached ${attachments.length} file(s)]` : ""),
            timestamp: formatTimestamp(now)
        };

        const initialAssistantMessage = {
            id: aMsgId,
            parentId: uMsgId,
            role: "assistant",
            content: "",
            timestamp: formatTimestamp(new Date()),
            confidence: "medium",
            sources: [],
            bookmarked: false,
            reaction: null
        };

        setStreamingMessageId(aMsgId);

        setActiveChildMap(prev => {
            const next = { ...prev };
            if (finalParentId) {
                next[finalParentId] = uMsgId;
            } else {
                next["root"] = uMsgId;
            }
            next[uMsgId] = aMsgId;
            return next;
        });

        if (!currentThreadId) {
            const newThread = createBlankThread();
            currentThreadId = newThread.id;
            newThread.title = displayQuestion ? displayQuestion.slice(0, 42) : "New chat";
            newThread.preview = displayQuestion || (attachments.length ? `Attached ${attachments.length} file(s)` : "");
            newThread.hasFiles = attachments.length > 0;
            newThread.messages = [userMessage, initialAssistantMessage];

            setThreads((currentThreads) => [newThread, ...currentThreads]);
            setActiveThreadId(currentThreadId);
        } else {
            setThreads((currentThreads) => currentThreads.map((thread) => {
                if (thread.id !== currentThreadId) {
                    return thread;
                }

                const nextTitle = thread.title === "New chat" ? (displayQuestion ? displayQuestion.slice(0, 42) : "New chat") : thread.title;

                return {
                    ...thread,
                    title: nextTitle,
                    preview: displayQuestion || (attachments.length ? `Attached ${attachments.length} file(s)` : ""),
                    updatedLabel: formatThreadLabel(now),
                    hasFiles: thread.hasFiles || attachments.length > 0,
                    messages: [...thread.messages, userMessage, initialAssistantMessage]
                };
            }));
        }

        try {
            await askEduMate({
                question: attachments.length ? `${trimmedQuestion}\n\nAttachments: ${attachments.map((file) => file.name).join(", ")}` : trimmedQuestion,
                conversationId,
                latitude: overrideCoords?.lat || gpsCoords?.lat,
                longitude: overrideCoords?.lng || gpsCoords?.lng,
                signal: controller.signal,
                userMessageId: uMsgId,
                assistantMessageId: aMsgId,
                parentId: finalParentId,
                language: activeLang,
                onChunk: (event) => {
                    if (event.type === "status") {
                        VoiceConversationManager.handleSseStatus(event.status);
                    } else if (event.type === "chunk") {
                        VoiceConversationManager.handleSseStatus("generating_response");
                        finalText += event.content;
                        setStreamingText((prev) => prev + event.content);
                    } else if (event.type === "done") {
                        const finalMessageText = (finalText && finalText.trim().length > 0) ? finalText : (event.message || "");
                        finalText = finalMessageText;
                        setStreamingText("");
                        setStreamingMessageId(null);
                        
                        if (event.conversationId) {
                            setConversationId(event.conversationId);
                        }

                        setActiveChildMap(prev => {
                            const next = { ...prev };
                            if (finalParentId) {
                                next[finalParentId] = uMsgId;
                            } else {
                                next["root"] = uMsgId;
                            }
                            next[uMsgId] = aMsgId;
                            return next;
                        });
                        
                        setThreads((currentThreads) => currentThreads.map((thread) => {
                            if (thread.id !== currentThreadId) {
                                return thread;
                            }
                            return {
                                ...thread,
                                serverConversationId: event.conversationId || thread.serverConversationId || null,
                                messages: thread.messages.map((m) => {
                                    if (m.id === aMsgId) {
                                        return {
                                            ...m,
                                            content: finalMessageText || m.content,
                                            sources: event.sources || [],
                                            confidence: event.confidence || "medium",
                                            mapData: event.mapData || null,
                                            requiresLocationPermission: event.requiresLocationPermission || false
                                        };
                                    }
                                    return m;
                                }),
                                preview: finalMessageText || thread.preview,
                                updatedLabel: formatThreadLabel(new Date())
                            };
                        }));
                    } else if (event.type === "error") {
                        throw new Error(event.message || "An error occurred during generation.");
                    }
                }
            });
            return finalText;
        } catch (error) {
            setStreamingText("");
            setStreamingMessageId(null);
            
            if (error?.status === 401) {
                logout();
                alert("Session expired. Please log in again.");
                return;
            }
            
            if (error?.name === "AbortError") {
                setThreads((currentThreads) => currentThreads.map((thread) => {
                    if (thread.id !== currentThreadId) {
                        return thread;
                    }

                    return {
                        ...thread,
                        messages: thread.messages.map((m) => {
                            if (m.id === aMsgId) {
                                return {
                                    ...m,
                                    content: m.content ? `${m.content}\n\n[Generation stopped.]` : "Generation stopped.",
                                    confidence: "low"
                                };
                            }
                            return m;
                        })
                    };
                }));

                return;
            }

            setThreads((currentThreads) => currentThreads.map((thread) => {
                if (thread.id !== currentThreadId) {
                    return thread;
                }

                return {
                    ...thread,
                    messages: thread.messages.map((m) => {
                        if (m.id === aMsgId) {
                            let errorMsg = error?.message || "EduMate is unavailable right now. Please retry.";
                            if (errorMsg.toLowerCase().includes("failed to fetch") || errorMsg.includes("LLAMA_TIMEOUT")) {
                                errorMsg = "Local AI model did not respond in time.";
                            }
                            return {
                                ...m,
                                content: m.content ? `${m.content}\n\n[Error: ${errorMsg}]` : errorMsg,
                                confidence: "low"
                            };
                        }
                        return m;
                    })
                };
            }));
        } finally {
            setLoading(false);
            abortRef.current = null;
            setAttachments([]);
        }
    }, [activeThreadId, attachments, conversationId, loading, gpsCoords, activeBranchMessages, activeChildMap, activeLang]);

    const visibleMessages = useMemo(() => {
        if (!activeBranchMessages?.length) {
            return [];
        }

        let filtered = activeBranchMessages.filter((message) => {
            if (!message) return false;
            if (message.id === streamingMessageId && !message.content && !streamingText) {
                return false;
            }
            return true;
        });

        if (!messageSearch?.trim()) {
            return filtered;
        }

        const query = messageSearch.trim().toLowerCase();

        return filtered.filter((message) => String(message?.content || "").toLowerCase().includes(query));
    }, [activeBranchMessages, messageSearch, streamingMessageId, streamingText]);

    const groupedSections = useMemo(() => {
        const query = (chatSearch || "").trim().toLowerCase();

        const filteredThreads = (threads || []).filter((thread) => {
            if (!query) {
                return true;
            }

            return [thread.title, thread.preview, ...(thread.messages || []).map((message) => message?.content || "")].join(" ").toLowerCase().includes(query);
        });

        return [
            { label: "Pinned", items: filteredThreads.filter((thread) => thread.pinned) },
            { label: "Today", items: filteredThreads.filter((thread) => thread.bucket === "Today" && !thread.pinned) },
            { label: "Yesterday", items: filteredThreads.filter((thread) => thread.bucket === "Yesterday" && !thread.pinned) },
            { label: "Previous Week", items: filteredThreads.filter((thread) => thread.bucket === "Previous Week" && !thread.pinned) },
            { label: "Archive", items: filteredThreads.filter((thread) => thread.bucket === "Archive") }
        ];
    }, [threads, chatSearch]);

    useEffect(() => {
        if (!threads.some((thread) => thread.id === activeThreadId)) {
            setActiveThreadId(threads[0]?.id || null);
        }
    }, [threads, activeThreadId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [visibleMessages.length, loading, activeThreadId]);

    const updateThread = useCallback((threadId, updater) => {
        setThreads((currentThreads) => currentThreads.map((thread) => thread.id === threadId ? updater(thread) : thread));
    }, []);

    const createNewChat = useCallback(() => {
        const thread = createBlankThread();

        setThreads((currentThreads) => [thread, ...currentThreads]);
        setActiveThreadId(thread.id);
        setInput("");
        setAttachments([]);
        setMessageSearch("");
        setChatSearch("");
        abortRef.current?.abort();
    }, []);

    const handleSelectThread = useCallback((threadId) => {
        setActiveThreadId(threadId);
        const selectedThread = threads.find((thread) => thread.id === threadId);
        setConversationId(selectedThread?.serverConversationId || null);
        setMessageSearch("");
        setChatSearch("");
        setAttachments([]);
        setInput("");
        abortRef.current?.abort();
    }, [threads]);

    const handleRenameThread = useCallback((threadId) => {
        const targetThread = threads.find((thread) => thread.id === threadId);
        const nextTitle = window.prompt("Rename chat", targetThread?.title || "");

        if (!nextTitle?.trim()) {
            return;
        }

        updateThread(threadId, (thread) => ({
            ...thread,
            title: nextTitle.trim(),
            updatedLabel: formatThreadLabel(new Date())
        }));
    }, [threads, updateThread]);

    const handleDeleteThread = useCallback((threadId) => {
        const targetThread = threads.find((thread) => thread.id === threadId);

        if (!targetThread) {
            return;
        }

        if (!window.confirm(`Delete "${targetThread.title}"?`)) {
            return;
        }

        setThreads((currentThreads) => currentThreads.filter((thread) => thread.id !== threadId));
    }, [threads]);

    const handlePinThread = useCallback((threadId) => {
        updateThread(threadId, (thread) => ({
            ...thread,
            pinned: !thread.pinned,
            updatedLabel: formatThreadLabel(new Date())
        }));
    }, [updateThread]);

    const handleArchiveThread = useCallback((threadId) => {
        updateThread(threadId, (thread) => ({
            ...thread,
            archived: true,
            bucket: "Archive",
            updatedLabel: formatThreadLabel(new Date())
        }));
    }, [updateThread]);

    const handleExportThread = useCallback((threadId) => {
        const thread = threads.find((item) => item.id === threadId);

        if (!thread) {
            return;
        }

        const exportContent = thread.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");

        downloadTextFile(
            `${thread.title.replace(/\s+/g, "-").toLowerCase() || "chat"}.md`,
            `# ${thread.title}\n\n${exportContent || "No messages yet."}`
        );
    }, [threads]);

    const handleCopy = useCallback((message) => {
        void navigator.clipboard.writeText(message.content);
    }, []);

    const handleShare = useCallback((message) => {
        const payload = {
            title: activeThread?.title || "EduMate Chat",
            text: message.content
        };

        if (navigator.share) {
            void navigator.share(payload);
            return;
        }

        void navigator.clipboard.writeText(message.content);
    }, [activeThread]);

    const handleBookmark = useCallback((message) => {
        setThreads((currentThreads) => currentThreads.map((thread) => {
            if (thread.id !== activeThreadId) {
                return thread;
            }

            return {
                ...thread,
                messages: thread.messages.map((item) => item.id === message.id ? { ...item, bookmarked: !item.bookmarked } : item)
            };
        }));
    }, [activeThreadId]);

    const handleRate = useCallback((message, reaction) => {
        setThreads((currentThreads) => currentThreads.map((thread) => {
            if (thread.id !== activeThreadId) {
                return thread;
            }

            return {
                ...thread,
                messages: thread.messages.map((item) => item.id === message.id ? { ...item, reaction } : item)
            };
        }));
    }, [activeThreadId]);

    const handleExportMarkdown = useCallback((message) => {
        downloadTextFile(
            `${(activeThread?.title || "response").replace(/\s+/g, "-").toLowerCase()}-response.md`,
            message.content
        );
    }, [activeThread]);

    const handleDownloadPdf = useCallback((message) => {
        const printWindow = window.open("", "_blank", "width=960,height=720");

        if (!printWindow) {
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>${activeThread?.title || "EduMate Response"}</title>
                    <style>
                        body{font-family:Inter,Segoe UI,sans-serif;padding:40px;line-height:1.6;color:#0f172a;background:#f8fafc;}
                        pre{white-space:pre-wrap;background:#0f172a;color:#fff;padding:18px;border-radius:16px;}
                        h1{font-size:28px;margin-bottom:12px;}
                    </style>
                </head>
                <body>
                    <h1>${activeThread?.title || "EduMate Response"}</h1>
                    <pre>${message.content.replace(/</g, "&lt;")}</pre>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }, [activeThread]);

    const handleExportDocx = useCallback((message) => {
        const html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <title>${activeThread?.title || "EduMate Response"}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    pre { background: #f4f4f5; padding: 12px; border: 1px solid #e4e4e7; font-family: monospace; }
                </style>
            </head>
            <body>
                <h2>${activeThread?.title || "EduMate Response"}</h2>
                <div style="font-size: 11pt;">${message.content.replace(/\n/g, "<br/>")}</div>
            </body>
            </html>
        `;
        downloadTextFile(
            `${(activeThread?.title || "response").replace(/\s+/g, "-").toLowerCase()}-response.docx`,
            html,
            "application/msword"
        );
    }, [activeThread]);

    const handleStopGenerating = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const handleAttachFiles = useCallback((files) => {
        const nextFiles = files.map((file) => ({
            id: safeId("file"),
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            progress: 100
        }));

        setAttachments((currentFiles) => [...currentFiles, ...nextFiles]);

        setThreads((currentThreads) => currentThreads.map((thread) => thread.id === activeThreadId ? {
            ...thread,
            hasFiles: true
        } : thread));
    }, [activeThreadId]);

    const handleRemoveAttachment = useCallback((attachmentId) => {
        setAttachments((currentFiles) => currentFiles.filter((file) => file.id !== attachmentId));
    }, []);

    const handleClearInput = useCallback(() => {
        setInput("");
    }, []);

    const handleAddEmoji = useCallback(() => {
        setInput((currentValue) => `${currentValue}${currentValue ? " " : ""}😊`);
    }, []);

    const handleFocusSearch = useCallback(() => {
        const searchField = document.querySelector(".edu-chat-search-box input");

        searchField?.focus();
    }, []);

    const handleSidebarToggle = useCallback(() => {
        setSidebarCollapsed((current) => !current);
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        navigate("/login");
    }, [logout, navigate]);

    const currentUserName = useMemo(() => {
        const fullName = user?.fullName?.trim();

        if (!fullName) {
            return "Raju";
        }

        return fullName.split(/\s+/)[0] || "Raju";
    }, [user]);

    const handleSwitchBranch = useCallback((parentId, childId) => {
        setActiveChildMap(prev => ({
            ...prev,
            [parentId]: childId
        }));
    }, []);

    const handleEditMessage = useCallback(async (msg, newText) => {
        await sendMessage(newText, null, msg.parentId);
    }, [sendMessage]);

    const handleDeleteMessage = useCallback((msg) => {
        if (!window.confirm("Delete this message and its branch?")) return;
        
        setThreads(prevThreads => prevThreads.map(thread => {
            if (thread.id !== activeThreadId) return thread;
            
            const toDelete = new Set([msg.id]);
            let len;
            do {
                len = toDelete.size;
                thread.messages.forEach(m => {
                    if (m.parentId && toDelete.has(m.parentId)) {
                        toDelete.add(m.id);
                    }
                });
            } while (toDelete.size > len);
            
            const nextMessages = thread.messages.filter(m => !toDelete.has(m.id));
            return {
                ...thread,
                messages: nextMessages
            };
        }));
    }, [activeThreadId]);

    const handlePinMessage = useCallback((msg) => {
        setThreads(prevThreads => prevThreads.map(thread => {
            if (thread.id !== activeThreadId) return thread;
            return {
                ...thread,
                messages: thread.messages.map(m => m.id === msg.id ? { ...m, pinned: !m.pinned } : m)
            };
        }));
    }, [activeThreadId]);

    const handleLocationAction = useCallback(async (messageId, action) => {
        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;
        const msg = thread.messages.find(m => m.id === messageId);
        if (!msg || !msg.mapData || !msg.mapData.destination) return;

        const destName = msg.mapData.destination.name;

        if (action.type === "gps") {
            const coords = { lat: action.lat, lng: action.lng };
            setGpsCoords(coords);
            await sendMessage(`How can I reach ${destName} from my current location`, coords);
        } else if (action.type === "manual") {
            await sendMessage(`How can I reach ${destName} from ${action.value}`);
        }
    }, [threads, activeThreadId, sendMessage]);

    useEffect(() => {
        if (initialPrompt && !hasSubmittedInitialPrompt) {
            setHasSubmittedInitialPrompt(true);
            void sendMessage(initialPrompt);
        }
    }, [initialPrompt, hasSubmittedInitialPrompt, sendMessage]);

    const handleSubmitFromCard = useCallback((promptText) => {
        setInput(promptText);
        void sendMessage(promptText);
    }, [sendMessage]);

    return (
        <main className={`edu-chat-page ${sidebarCollapsed ? "is-collapsed" : ""}`}>
            {!isOnline ? (
                <div className="edu-chat-offline-banner" role="status">
                    You are offline. Drafts stay on this device, and recent conversations remain visible.
                </div>
            ) : null}

            <Sidebar
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={handleSidebarToggle}
                onNewChat={createNewChat}
                searchValue={chatSearch}
                onSearchChange={setChatSearch}
                sections={groupedSections}
                activeThreadId={activeThreadId}
                onSelectThread={handleSelectThread}
                onRenameThread={handleRenameThread}
                onDeleteThread={handleDeleteThread}
                onPinThread={handlePinThread}
                onArchiveThread={handleArchiveThread}
                onExportThread={handleExportThread}
                isAuthenticated={isAuthenticated}
                user={user}
                onLogout={handleLogout}
                sendMessage={sendMessage}
                onVoiceContinuousClick={() => startContinuousConversation(sendMessage)}
                activeLang={activeLang}
                setLanguage={setLanguage}
                setInput={setInput}
                voiceState={voiceState}
            />

            <section className="edu-chat-workspace">
                <TopBar
                    currentChat={activeThread?.title || "Campus AI Companion"}
                    institutionName="EduMate Institute"
                    providerName="EduMate Core v3"
                    knowledgeBaseStatus="Knowledge base connected"
                    connectionStatus={isOnline ? "Online" : "Offline"}
                    themeControls={(
                        <ThemeControls
                            theme={theme}
                            onToggleSidebar={handleSidebarToggle}
                            onFocusSearch={handleFocusSearch}
                            onNewChat={createNewChat}
                        />
                    )}
                    user={user}
                    unreadCount={3}
                    messageSearch={messageSearch}
                    onMessageSearchChange={setMessageSearch}
                />

                <div className="edu-chat-panel">
                    {!visibleMessages.length && !loading ? (
                        <div className="edu-chat-welcome-shell">
                            <div className="edu-chat-welcome-copy">
                                <span className="edu-chat-section-label">AI Educational Platform</span>
                                <h2>Hello, {currentUserName} 👋</h2>
                                <p>How can I help you today?</p>
                            </div>

                            <SuggestionCards onSelectPrompt={handleSubmitFromCard} />
                        </div>
                    ) : (
                        <div className="edu-chat-thread" aria-label="Conversation">
                            {visibleMessages.map((message, index) => {
                                const siblings = activeThread?.messages?.filter(m => m.parentId === message.parentId) || [];
                                const displayMsg = message.id === streamingMessageId && streamingText ? { ...message, content: streamingText } : message;
                                return (
                                    <MessageBubble
                                        key={message.id}
                                        message={displayMsg}
                                        isStreaming={message.id === streamingMessageId}
                                        prevMessage={index > 0 ? visibleMessages[index - 1] : null}
                                        onCopy={handleCopy}
                                        onRegenerate={() => {
                                            const userMsg = activeThread?.messages?.find(m => m.id === message.parentId);
                                            if (userMsg) {
                                                void sendMessage(userMsg.content, null, userMsg.parentId);
                                            } else {
                                                void sendMessage(message.content, null, message.parentId);
                                            }
                                        }}
                                        onShare={handleShare}
                                        onBookmark={handleBookmark}
                                        onRate={handleRate}
                                        onExportMarkdown={handleExportMarkdown}
                                        onDownloadPdf={handleDownloadPdf}
                                        onLocationAction={handleLocationAction}
                                        siblings={siblings}
                                        onSwitchBranch={handleSwitchBranch}
                                        onEditMessage={handleEditMessage}
                                        onDeleteMessage={handleDeleteMessage}
                                        onPinMessage={handlePinMessage}
                                        onExportDocx={handleExportDocx}
                                    />
                                );
                            })}

                            {loading && !streamingText ? <TypingIndicator /> : null}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>

                <div className="edu-chat-footer">
                    <ChatInput
                        key={activeThreadId}
                        value={input}
                        onChange={setInput}
                        onSubmit={(val) => void sendMessage(val)}
                        isLoading={loading}
                        onStopGenerating={handleStopGenerating}
                        onAttachFiles={handleAttachFiles}
                        onAddEmoji={handleAddEmoji}
                        onClear={handleClearInput}
                        attachments={attachments}
                        onRemoveAttachment={handleRemoveAttachment}
                        onVoiceSingleClick={() => {
                            if (voiceState === "listening" && !isContinuousMode) {
                                stopConversation();
                            } else {
                                startSingleQuery(sendMessage);
                            }
                        }}
                        onVoiceContinuousClick={() => {
                            if (isContinuousMode) {
                                stopConversation();
                            } else {
                                startContinuousConversation(sendMessage);
                            }
                        }}
                        isVoiceSingleActive={voiceState === "listening" && !isContinuousMode}
                        isVoiceContinuousActive={isContinuousMode}
                    />
                </div>
            </section>

            <VoiceUIComponent
                voiceState={voiceState}
                transcript={transcript}
                elapsedSeconds={elapsedSeconds}
                activeLang={activeLang}
                isMuted={isMuted}
                isContinuousMode={isContinuousMode}
                startListening={startListening}
                stopListening={stopListening}
                stopResponse={stopResponse}
                stopConversation={stopConversation}
                toggleMute={toggleMute}
                setLanguage={setLanguage}
                replayResponse={replayResponse}
                userInterruption={userInterruption}
            />
        </main>
    );
}

export default Chat;
