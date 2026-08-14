import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
    Archive,
    BookOpen,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit3,
    FileText,
    FolderDown,
    Globe,
    History,
    LogOut,
    MapPin,
    MessageSquare,
    Mic,
    Pin,
    Plus,
    Route,
    School,
    Search,
    Settings,
    Sparkles,
    Trash2,
    UserCircle,
    X
} from "lucide-react";
import "./Sidebar.css";

function Sidebar({
    isCollapsed,
    onToggleCollapse,
    onNewChat,
    searchValue,
    onSearchChange,
    sections,
    activeThreadId,
    onSelectThread,
    onRenameThread,
    onDeleteThread,
    onPinThread,
    onArchiveThread,
    onExportThread,
    isAuthenticated,
    user,
    onLogout,
    // Integration props
    sendMessage,
    onVoiceContinuousClick,
    activeLang,
    setLanguage,
    setInput,
    voiceState
}) {
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [modalSearch, setModalSearch] = useState("");
    const [showLanguagePopup, setShowLanguagePopup] = useState(false);

    React.useEffect(() => {
        if (!showLanguagePopup) return;

        const handleOutsideClick = (event) => {
            const popupEl = document.querySelector(".edu-lang-popup");
            const triggerEl = document.querySelector(".edu-chat-feature-card.all-languages");
            if (popupEl && !popupEl.contains(event.target) && triggerEl && !triggerEl.contains(event.target)) {
                setShowLanguagePopup(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setShowLanguagePopup(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showLanguagePopup]);

    const avatarInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || "R";

    // Extract pinned and recent chats from sections
    const pinnedSection = sections.find((s) => s.label === "Pinned");
    const pinnedItems = pinnedSection ? pinnedSection.items : [];

    const recentItems = sections
        .filter((s) => ["Today", "Yesterday", "Previous Week"].includes(s.label))
        .flatMap((s) => s.items);

    // Dynamic feature active states based on current conversation content
    const activeThread = sections.flatMap((s) => s.items).find((t) => t.id === activeThreadId);
    const activeMessages = activeThread?.messages || [];

    const isVoiceActive = ["listening", "speaking", "processing"].includes(voiceState);

    // Dynamic icon selection based on chat title keywords
    const getChatIcon = (title = "") => {
        const lower = title.toLowerCase();
        if (lower.includes("map") || lower.includes("navigate") || lower.includes("reach") || lower.includes("location")) {
            return <MapPin className="chat-icon" size={13} />;
        }
        if (lower.includes("route") || lower.includes("direction") || lower.includes("commute")) {
            return <Route className="chat-icon" size={13} />;
        }
        if (lower.includes("admission") || lower.includes("fees") || lower.includes("document") || lower.includes("pdf")) {
            return <FileText className="chat-icon" size={13} />;
        }
        return <BookOpen className="chat-icon" size={13} />;
    };

    // Feature card click action handler
    const handleFeatureClick = (featureName) => {
        if (featureName === "language") {
            setShowLanguagePopup(prev => !prev);
            return;
        }

        if (!sendMessage) return;

        switch (featureName) {
            case "voice":
                if (onVoiceContinuousClick) {
                    onVoiceContinuousClick();
                }
                break;
            case "navigation":
                setInput("How do I navigate the campus?");
                void sendMessage("How do I navigate the campus?");
                break;
            case "routes":
                setInput("Show me route information between academic blocks.");
                void sendMessage("Show me route information between academic blocks.");
                break;
            case "documents":
                setInput("What documents can you search in the knowledge base?");
                void sendMessage("What documents can you search in the knowledge base?");
                break;
            case "history":
                setShowHistoryModal(true);
                break;
            case "context":
                setInput("Explain how you use previous message history to maintain context.");
                void sendMessage("Explain how you use previous message history to maintain context.");
                break;
            case "sources":
                setInput("Show me how you cite your sources and page numbers.");
                void sendMessage("Show me how you cite your sources and page numbers.");
                break;
            default:
                break;
        }
    };

    // Build list of all threads for history manager modal
    const allThreads = sections.flatMap(s => s.items);
    
    // De-duplicate threads by ID
    const uniqueThreadsMap = new Map();
    allThreads.forEach(t => {
        if (t && t.id) uniqueThreadsMap.set(t.id, t);
    });
    const uniqueThreads = Array.from(uniqueThreadsMap.values());

    const filteredModalThreads = uniqueThreads.filter(t => 
        (t.title || "").toLowerCase().includes(modalSearch.toLowerCase()) || 
        (t.preview || "").toLowerCase().includes(modalSearch.toLowerCase())
    );

    return (
        <>
            <aside className={`edu-chat-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
                <div className="edu-chat-sidebar-shell">
                    
                    {/* 1. Brand Row */}
                    <div className="edu-chat-brand-row">
                        <Link className="edu-chat-brand" to="/" title="EduMate Home">
                            <span className="edu-chat-brand-mark">E</span>
                            <span className="edu-chat-brand-copy">
                                <strong>EduMate</strong>
                                <small>AI learning assistant</small>
                            </span>
                        </Link>
                        <button 
                            type="button" 
                            className="edu-chat-collapse-button" 
                            onClick={onToggleCollapse} 
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    {/* 2. New Chat Button */}
                    <button 
                        type="button" 
                        className="edu-chat-primary-button" 
                        onClick={onNewChat}
                        title="Start New Chat"
                        aria-label="Start New Chat"
                    >
                        <Plus size={16} />
                        <span>New Chat</span>
                    </button>

                    {/* 3. Search Chat */}
                    <label className="edu-chat-search-box">
                        <Search size={14} />
                        <input
                            type="search"
                            value={searchValue}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search chats"
                            aria-label="Search chats"
                        />
                    </label>

                    {/* 4. Features Section */}
                    <div className="edu-sidebar-section-heading features-header">
                        <Sparkles size={11} />
                        <span>Features</span>
                    </div>

                    <div className="edu-chat-features-list">
                        <div 
                            className={`edu-chat-feature-card all-languages ${showLanguagePopup ? "active-popup" : ""}`}
                            onClick={() => handleFeatureClick("language")}
                            title="Choose language"
                            role="button"
                            tabIndex={0}
                            aria-label="Choose language support option"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    handleFeatureClick("language");
                                }
                            }}
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <Globe size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">All Language Support</span>
                            <ChevronDown size={14} className="edu-lang-chevron" />
                        </div>

                        <div 
                            className="edu-chat-feature-card context-aware"
                            onClick={() => handleFeatureClick("context")}
                            title="Ask about conversation memory context"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <MessageSquare size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Context Aware Response</span>
                        </div>

                        <div 
                            className="edu-chat-feature-card chat-history"
                            onClick={() => handleFeatureClick("history")}
                            title="Open history manager modal"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <History size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Chat History</span>
                        </div>

                        <div 
                            className="edu-chat-feature-card campus-nav"
                            onClick={() => handleFeatureClick("navigation")}
                            title="Send prompt to show interactive campus map"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <School size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Campus Navigation</span>
                        </div>

                        <div 
                            className="edu-chat-feature-card doc-retrieval"
                            onClick={() => handleFeatureClick("documents")}
                            title="Ask about searchable knowledge base files"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <FileText size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Document Retrieval</span>
                        </div>

                        <div 
                            className={`edu-chat-feature-card voice-assistant ${isVoiceActive ? "is-active" : ""}`}
                            onClick={() => handleFeatureClick("voice")}
                            title={`Toggle voice listening mode (active: ${voiceState === "listening" ? "Listening" : "Idle"})`}
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <Mic size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Voice Assistant</span>
                        </div>

                        <div 
                            className="edu-chat-feature-card route-info"
                            onClick={() => handleFeatureClick("routes")}
                            title="Get route directions between buildings"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <Route size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Route Information</span>
                        </div>

                        <div 
                            className="edu-chat-feature-card sources-cited"
                            onClick={() => handleFeatureClick("sources")}
                            title="Ask how answers cite PDF pages"
                        >
                            <div className="edu-chat-feature-icon-wrapper">
                                <MapPin size={16} />
                            </div>
                            <span className="edu-chat-feature-card-text">Sources Cities Answer</span>
                        </div>
                    </div>

                    {/* 5. Pinned Chats */}
                    <div className="edu-sidebar-section-heading">
                        <Pin size={11} style={{ transform: "rotate(45deg)" }} />
                        <span>Pinned Chats</span>
                    </div>

                    <div className="edu-pinned-chats-container">
                        {pinnedItems.length > 0 ? (
                            pinnedItems.map((thread) => {
                                const isActive = thread.id === activeThreadId;
                                return (
                                    <div 
                                        key={thread.id} 
                                        className={`edu-pinned-item ${isActive ? "is-active" : ""}`}
                                        onClick={() => onSelectThread(thread.id)}
                                        title={thread.title}
                                    >
                                        <div className="edu-pinned-item-info">
                                            <Pin size={12} />
                                            <span className="edu-pinned-title">{thread.title}</span>
                                        </div>

                                        <div className="edu-recent-actions-overlay" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn pin active" 
                                                onClick={() => onPinThread(thread.id)} 
                                                title="Unpin chat"
                                            >
                                                <Pin size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn" 
                                                onClick={() => onRenameThread(thread.id)} 
                                                title="Rename chat"
                                            >
                                                <Edit3 size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn" 
                                                onClick={() => onArchiveThread(thread.id)} 
                                                title="Archive chat"
                                            >
                                                <Archive size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn" 
                                                onClick={() => onExportThread(thread.id)} 
                                                title="Export chat"
                                            >
                                                <FolderDown size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn delete" 
                                                onClick={() => onDeleteThread(thread.id)} 
                                                title="Delete chat"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="edu-pinned-empty-state">
                                Pin important chats for quick access
                            </div>
                        )}
                    </div>

                    {/* 6. Recent Chats */}
                    <div className="edu-sidebar-section-heading">
                        <BookOpen size={11} />
                        <span>Recent Chats</span>
                    </div>

                    <div className="edu-recent-chats-list">
                        {recentItems.map((thread) => {
                            const isActive = thread.id === activeThreadId;
                            return (
                                <div 
                                    key={thread.id} 
                                    className={`edu-recent-item ${isActive ? "is-active" : ""}`}
                                    onClick={() => onSelectThread(thread.id)}
                                    title={thread.title}
                                >
                                    <div className="edu-recent-item-info">
                                        {getChatIcon(thread.title)}
                                        <div className="edu-recent-title-group">
                                            <span className="edu-recent-title">{thread.title}</span>
                                            <div className="edu-recent-meta">
                                                <small>{thread.updatedLabel}</small>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="edu-recent-actions-overlay" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            type="button" 
                                            className="edu-sidebar-action-btn pin" 
                                            onClick={() => onPinThread(thread.id)} 
                                            title="Pin chat"
                                        >
                                            <Pin size={12} />
                                        </button>
                                        <button 
                                            type="button" 
                                            className="edu-sidebar-action-btn" 
                                            onClick={() => onRenameThread(thread.id)} 
                                            title="Rename chat"
                                        >
                                            <Edit3 size={12} />
                                        </button>
                                        <button 
                                            type="button" 
                                            className="edu-sidebar-action-btn" 
                                            onClick={() => onArchiveThread(thread.id)} 
                                            title="Archive chat"
                                        >
                                            <Archive size={12} />
                                        </button>
                                        <button 
                                            type="button" 
                                            className="edu-sidebar-action-btn" 
                                            onClick={() => onExportThread(thread.id)} 
                                            title="Export chat"
                                        >
                                            <FolderDown size={12} />
                                        </button>
                                        <button 
                                            type="button" 
                                            className="edu-sidebar-action-btn delete" 
                                            onClick={() => onDeleteThread(thread.id)} 
                                            title="Delete chat"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 7. View All Chats Link */}
                    <button 
                        type="button" 
                        className="edu-view-all-chats-btn" 
                        onClick={() => setShowHistoryModal(true)}
                        title="Open history manager console"
                    >
                        <span>View all chats &gt;</span>
                    </button>

                    {/* 8. Footer Section */}
                    <div className="edu-chat-sidebar-footer">
                        {isAuthenticated ? (
                            <div className="edu-sidebar-user-widget">
                                <div className="edu-sidebar-avatar">
                                    {user?.avatar ? (
                                        <img className="edu-sidebar-avatar-img" src={user.avatar} alt="Profile" />
                                    ) : (
                                        avatarInitial
                                    )}
                                </div>
                                <div className="edu-sidebar-user-info">
                                    <span className="edu-sidebar-username">{user?.fullName || "Profile"}</span>
                                    <span className="edu-sidebar-role">{user?.role || "Student"}</span>
                                </div>
                                <div className="edu-sidebar-footer-actions">
                                    <Link to="/profile" className="edu-sidebar-footer-action-btn" title="Profile Settings">
                                        <Settings size={14} />
                                    </Link>
                                    <button 
                                        type="button" 
                                        className="edu-sidebar-footer-action-btn logout" 
                                        onClick={onLogout} 
                                        title="Logout"
                                    >
                                        <LogOut size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="edu-sidebar-guest-widget">
                                <UserCircle size={18} />
                                <span>Guest User</span>
                            </div>
                        )}
                    </div>
                </div>
                {showLanguagePopup && (
                    <div className="edu-lang-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="edu-lang-popup-title">Choose Language</div>
                        <div className="edu-lang-options-list">
                            <div 
                                className={`edu-lang-option-card ${activeLang === "en" ? "is-selected" : ""}`}
                                onClick={() => {
                                    setLanguage("en");
                                    setShowLanguagePopup(false);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Select English language"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        setLanguage("en");
                                        setShowLanguagePopup(false);
                                    }
                                }}
                            >
                                <span className="edu-lang-name">English</span>
                                <span className="edu-lang-radio-circle">
                                    {activeLang === "en" && <span className="edu-lang-radio-dot" />}
                                </span>
                            </div>
                            <div 
                                className={`edu-lang-option-card ${activeLang === "hi" ? "is-selected" : ""}`}
                                onClick={() => {
                                    setLanguage("hi");
                                    setShowLanguagePopup(false);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Select Hindi language"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        setLanguage("hi");
                                        setShowLanguagePopup(false);
                                    }
                                }}
                            >
                                <span className="edu-lang-name">Hindi</span>
                                <span className="edu-lang-radio-circle">
                                    {activeLang === "hi" && <span className="edu-lang-radio-dot" />}
                                </span>
                            </div>
                            <div 
                                className={`edu-lang-option-card ${activeLang === "bn" ? "is-selected" : ""}`}
                                onClick={() => {
                                    setLanguage("bn");
                                    setShowLanguagePopup(false);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Select Bengali language"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        setLanguage("bn");
                                        setShowLanguagePopup(false);
                                    }
                                }}
                            >
                                <span className="edu-lang-name">Bengali</span>
                                <span className="edu-lang-radio-circle">
                                    {activeLang === "bn" && <span className="edu-lang-radio-dot" />}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* --- View All Chats / History Manager Modal --- */}
            {showHistoryModal && (
                <div className="edu-modal-backdrop" onClick={() => setShowHistoryModal(false)}>
                    <div className="edu-history-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edu-modal-header">
                            <h3><Clock size={18} /> Conversation History</h3>
                            <button 
                                type="button" 
                                className="edu-modal-close-btn" 
                                onClick={() => setShowHistoryModal(false)}
                                title="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="edu-modal-search-wrapper">
                            <div className="edu-modal-search-box">
                                <Search size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search conversation titles & previews..." 
                                    value={modalSearch} 
                                    onChange={(e) => setModalSearch(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="edu-modal-content">
                            {filteredModalThreads.length > 0 ? (
                                filteredModalThreads.map(thread => (
                                    <div key={thread.id} className="edu-modal-item">
                                        <div className="edu-modal-item-left" onClick={() => {
                                            onSelectThread(thread.id);
                                            setShowHistoryModal(false);
                                        }}>
                                            <div className="edu-modal-item-title-row">
                                                <span className="edu-modal-item-title">{thread.title}</span>
                                                <span className={`edu-modal-item-badge ${thread.pinned ? 'pinned' : thread.archived ? 'archived' : 'normal'}`}>
                                                    {thread.pinned ? 'Pinned' : thread.archived ? 'Archived' : 'Active'}
                                                </span>
                                            </div>
                                            <span className="edu-modal-item-preview">{thread.preview}</span>
                                        </div>
                                        <div className="edu-modal-item-actions">
                                            <button 
                                                type="button" 
                                                className={`edu-sidebar-action-btn pin ${thread.pinned ? "active" : ""}`} 
                                                onClick={() => onPinThread(thread.id)} 
                                                title={thread.pinned ? "Unpin chat" : "Pin chat"}
                                            >
                                                <Pin size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`edu-sidebar-action-btn archive ${thread.archived ? "active" : ""}`} 
                                                onClick={() => onArchiveThread(thread.id)} 
                                                title={thread.archived ? "Unarchive chat" : "Archive chat"}
                                            >
                                                <Archive size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn" 
                                                onClick={() => onRenameThread(thread.id)} 
                                                title="Rename chat"
                                            >
                                                <Edit3 size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn" 
                                                onClick={() => onExportThread(thread.id)} 
                                                title="Export chat to markdown"
                                            >
                                                <FolderDown size={12} />
                                            </button>
                                            <button 
                                                type="button" 
                                                className="edu-sidebar-action-btn delete" 
                                                onClick={() => {
                                                    if (window.confirm(`Are you sure you want to delete "${thread.title}"?`)) {
                                                        onDeleteThread(thread.id);
                                                    }
                                                }} 
                                                title="Delete chat"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="edu-modal-empty-state">No conversations found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Sidebar;