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

const CHAT_STORAGE_KEY = "edumate-chat-threads";
const CHAT_ACTIVE_KEY = "edumate-chat-active";

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
    const initialPrompt = useMemo(() => new URLSearchParams(location.search).get("q") || "", [location.search]);
    const [threads, setThreads] = useState(() => readStoredThreads());
    const [activeThreadId, setActiveThreadId] = useState(() => readStoredActiveThread(readStoredThreads()));
    const [input, setInput] = useState(initialPrompt);
    const [chatSearch, setChatSearch] = useState("");
    const [messageSearch, setMessageSearch] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
    const [hasSubmittedInitialPrompt, setHasSubmittedInitialPrompt] = useState(false);
    const abortRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads));
    }, [threads]);

    useEffect(() => {
        if (activeThreadId) {
            localStorage.setItem(CHAT_ACTIVE_KEY, activeThreadId);
        }
    }, [activeThreadId]);

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

    const visibleMessages = useMemo(() => {
        if (!activeThread?.messages?.length) {
            return [];
        }

        if (!messageSearch.trim()) {
            return activeThread.messages;
        }

        const query = messageSearch.trim().toLowerCase();

        return activeThread.messages.filter((message) => message.content.toLowerCase().includes(query));
    }, [activeThread, messageSearch]);

    const groupedSections = useMemo(() => {
        const query = messageSearch.trim().toLowerCase();

        const filteredThreads = threads.filter((thread) => {
            if (!query) {
                return true;
            }

            return [thread.title, thread.preview, ...(thread.messages || []).map((message) => message.content)].join(" ").toLowerCase().includes(query);
        });

        return [
            { label: "Pinned", items: filteredThreads.filter((thread) => thread.pinned) },
            { label: "Today", items: filteredThreads.filter((thread) => thread.bucket === "Today" && !thread.pinned) },
            { label: "Yesterday", items: filteredThreads.filter((thread) => thread.bucket === "Yesterday") },
            { label: "Previous Week", items: filteredThreads.filter((thread) => thread.bucket === "Previous Week") },
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
        setMessageSearch("");
        setChatSearch("");
        setAttachments([]);
        setInput("");
        abortRef.current?.abort();
    }, []);

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

    const sendMessage = useCallback(async (question) => {
        let currentThreadId = activeThreadId;
        const trimmedQuestion = question.trim();

        if ((!trimmedQuestion && attachments.length === 0) || loading) {
            return;
        }

        setLoading(true);
        setInput("");

        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        const now = new Date();
        const userMessage = {
            id: safeId("msg"),
            role: "user",
            content: trimmedQuestion || (attachments.length ? `[Attached ${attachments.length} file(s)]` : ""),
            timestamp: formatTimestamp(now)
        };

        if (!currentThreadId) {
            const newThread = createBlankThread();
            currentThreadId = newThread.id;
            newThread.title = trimmedQuestion ? trimmedQuestion.slice(0, 42) : "New chat";
            newThread.preview = trimmedQuestion || (attachments.length ? `Attached ${attachments.length} file(s)` : "");
            newThread.hasFiles = attachments.length > 0;
            newThread.messages = [userMessage];

            setThreads((currentThreads) => [newThread, ...currentThreads]);
            setActiveThreadId(currentThreadId);
        } else {
            setThreads((currentThreads) => currentThreads.map((thread) => {
                if (thread.id !== currentThreadId) {
                    return thread;
                }

                const nextTitle = thread.title === "New chat" ? (trimmedQuestion ? trimmedQuestion.slice(0, 42) : "New chat") : thread.title;

                return {
                    ...thread,
                    title: nextTitle,
                    preview: trimmedQuestion || (attachments.length ? `Attached ${attachments.length} file(s)` : ""),
                    updatedLabel: formatThreadLabel(now),
                    hasFiles: thread.hasFiles || attachments.length > 0,
                    messages: [...thread.messages, userMessage]
                };
            }));
        }

        const assistantMessageId = safeId("msg");
        const initialAssistantMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            timestamp: formatTimestamp(new Date()),
            confidence: "medium",
            sources: [],
            bookmarked: false,
            reaction: null
        };

        setThreads((currentThreads) => currentThreads.map((thread) => {
            if (thread.id !== currentThreadId) {
                return thread;
            }
            return {
                ...thread,
                messages: [...thread.messages, initialAssistantMessage]
            };
        }));

        try {
            await askEduMate({
                question: attachments.length ? `${trimmedQuestion}\n\nAttachments: ${attachments.map((file) => file.name).join(", ")}` : trimmedQuestion,
                conversationId,
                signal: controller.signal,
                onChunk: (event) => {
                    if (event.type === "chunk") {
                        setThreads((currentThreads) => currentThreads.map((thread) => {
                            if (thread.id !== currentThreadId) {
                                return thread;
                            }
                            return {
                                ...thread,
                                messages: thread.messages.map((m) => {
                                    if (m.id === assistantMessageId) {
                                        return {
                                            ...m,
                                            content: m.content + event.content
                                        };
                                    }
                                    return m;
                                })
                            };
                        }));
                    } else if (event.type === "done") {
                        if (event.conversationId) {
                            setConversationId(event.conversationId);
                        }
                        setThreads((currentThreads) => currentThreads.map((thread) => {
                            if (thread.id !== currentThreadId) {
                                return thread;
                            }
                            return {
                                ...thread,
                                messages: thread.messages.map((m) => {
                                    if (m.id === assistantMessageId) {
                                        return {
                                            ...m,
                                            content: event.message || m.content,
                                            sources: event.sources || [],
                                            confidence: event.confidence || "medium"
                                        };
                                    }
                                    return m;
                                }),
                                preview: event.message || thread.preview,
                                updatedLabel: formatThreadLabel(new Date())
                            };
                        }));
                    } else if (event.type === "error") {
                        throw new Error(event.message || "An error occurred during generation.");
                    }
                }
            });
        } catch (error) {
            if (error?.name === "AbortError") {
                setThreads((currentThreads) => currentThreads.map((thread) => {
                    if (thread.id !== currentThreadId) {
                        return thread;
                    }

                    return {
                        ...thread,
                        messages: thread.messages.map((m) => {
                            if (m.id === assistantMessageId) {
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
                        if (m.id === assistantMessageId) {
                            const errorMsg = error?.message || "EduMate is unavailable right now. Please retry.";
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
    }, [activeThreadId, attachments, conversationId, loading]);

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
                            {visibleMessages.map((message, index) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    prevMessage={index > 0 ? visibleMessages[index - 1] : null}
                                    onCopy={handleCopy}
                                    onRegenerate={() => {
                                        const previousUser = [...(activeThread?.messages || [])].reverse().find((entry) => entry.role === "user");
                                        void sendMessage(previousUser?.content || message.content);
                                    }}
                                    onShare={handleShare}
                                    onBookmark={handleBookmark}
                                    onRate={handleRate}
                                    onExportMarkdown={handleExportMarkdown}
                                    onDownloadPdf={handleDownloadPdf}
                                />
                            ))}

                            {loading ? <TypingIndicator /> : null}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>

                <div className="edu-chat-footer">
                    <ChatInput
                        value={input}
                        onChange={setInput}
                        onSubmit={() => void sendMessage(input)}
                        isLoading={loading}
                        onStopGenerating={handleStopGenerating}
                        onAttachFiles={handleAttachFiles}
                        onAddEmoji={handleAddEmoji}
                        onClear={handleClearInput}
                        attachments={attachments}
                        onRemoveAttachment={handleRemoveAttachment}
                    />
                </div>
            </section>
        </main>
    );
}

export default Chat;
