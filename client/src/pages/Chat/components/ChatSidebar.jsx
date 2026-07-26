import React, { useState, useEffect } from "react";
import { 
    MessageSquarePlus, 
    Trash2, 
    LogOut, 
    ChevronLeft, 
    ChevronRight, 
    GraduationCap, 
    UserCircle,
    Pin,
    Edit3,
    Archive,
    FolderDown,
    Search,
    Check,
    X,
    Settings
} from "lucide-react";
import useChat from "../hooks/useChat";
import useAuth from "../../../hooks/useAuth";
import { getChatDetails } from "../services/chatService";
import "../styles/ChatSidebar.css";

export default function ChatSidebar({ isOpen, isCollapsed, onToggleCollapse, onClose }) {
    const { threads, activeThreadId, selectThread, createNewThread, deleteThread, renameThread } = useChat();
    const { user, logout } = useAuth();

    const [searchQuery, setSearchQuery] = useState("");
    const [pinnedThreadIds, setPinnedThreadIds] = useState(() => {
        try {
            const saved = localStorage.getItem("edumate-pinned-threads");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [archivedThreadIds, setArchivedThreadIds] = useState(() => {
        try {
            const saved = localStorage.getItem("edumate-archived-threads");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [isEditingId, setIsEditingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");

    // Sync state changes to local storage
    useEffect(() => {
        localStorage.setItem("edumate-pinned-threads", JSON.stringify(pinnedThreadIds));
    }, [pinnedThreadIds]);

    useEffect(() => {
        localStorage.setItem("edumate-archived-threads", JSON.stringify(archivedThreadIds));
    }, [archivedThreadIds]);

    const handleSelect = (id) => {
        selectThread(id);
        if (onClose) onClose(); // close drawer on mobile
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this conversation?")) {
            deleteThread(id);
            // Clean up pin/archive state
            setPinnedThreadIds(prev => prev.filter(x => x !== id));
            setArchivedThreadIds(prev => prev.filter(x => x !== id));
        }
    };

    const togglePin = (e, id) => {
        e.stopPropagation();
        setPinnedThreadIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
        // Unarchive if pinning
        setArchivedThreadIds(prev => prev.filter(x => x !== id));
    };

    const toggleArchive = (e, id) => {
        e.stopPropagation();
        setArchivedThreadIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
        // Unpin if archiving
        setPinnedThreadIds(prev => prev.filter(x => x !== id));
    };

    const startRename = (e, id, currentTitle) => {
        e.stopPropagation();
        setIsEditingId(id);
        setRenameValue(currentTitle || "");
    };

    const saveRename = async (e, id) => {
        e.stopPropagation();
        if (renameValue.trim()) {
            try {
                await renameThread(id, renameValue.trim());
            } catch (err) {
                console.error("Rename error:", err);
            }
        }
        setIsEditingId(null);
    };

    const cancelRename = (e) => {
        e.stopPropagation();
        setIsEditingId(null);
    };

    const handleExportMarkdown = async (e, id, title) => {
        e.stopPropagation();
        try {
            const details = await getChatDetails(id);
            if (details.success && details.data) {
                const msgs = details.data.messages || [];
                let mdContent = `# Chat Session: ${title || "Untitled Chat"}\n\n`;
                mdContent += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
                
                msgs.forEach((m) => {
                    const roleName = m.role === "user" ? "User" : "EduMate AI";
                    mdContent += `### **${roleName}** (${new Date(m.createdAt || new Date()).toLocaleString()}):\n\n${m.content}\n\n---\n\n`;
                });
                
                const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `${(title || "chat").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error("Markdown export error:", err);
            alert("Failed to export chat thread details.");
        }
    };

    // Helper to generate dynamic item descriptions based on common keywords
    const getThreadDescription = (title = "") => {
        const lower = title.toLowerCase();
        if (lower.includes("admission")) {
            return "Required documents, steps, and deadlines.";
        }
        if (lower.includes("hostel")) {
            return "Comparing hostel facilities and commute.";
        }
        if (lower.includes("scholarship")) {
            return "Scholarship eligibility and application tips.";
        }
        if (lower.includes("exam") || lower.includes("notice") || lower.includes("archive")) {
            return "Important exam notices and updates.";
        }
        return "Recent discussion with EduMate assistant.";
    };

    // Filter threads locally
    const filteredThreads = threads.filter(t => 
        (t.title || "Untitled Chat").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group threads for rendering
    const getGroupedThreads = () => {
        const groups = {
            "Pinned": [],
            "Today": [],
            "Yesterday": [],
            "Previous Week": [],
            "Archive": []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        filteredThreads.forEach(t => {
            const id = t._id || t.id;
            if (archivedThreadIds.includes(id)) {
                groups["Archive"].push(t);
            } else if (pinnedThreadIds.includes(id)) {
                groups["Pinned"].push(t);
            } else {
                const date = new Date(t.updatedAt || t.createdAt);
                if (date >= startOfToday) {
                    groups["Today"].push(t);
                } else if (date >= yesterday) {
                    groups["Yesterday"].push(t);
                } else {
                    groups["Previous Week"].push(t);
                }
            }
        });

        return Object.entries(groups);
    };

    const grouped = getGroupedThreads();
    const avatarInitial = user?.fullName?.charAt(0)?.toUpperCase() || "R";

    return (
        <aside className={`chat-sidebar-drawer ${isOpen ? "open" : ""} ${isCollapsed ? "is-collapsed" : ""}`}>
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <GraduationCap className="brand-logo" size={24} />
                    <div className="brand-copy">
                        <span>EduMate</span>
                        <small>AI learning assistant</small>
                    </div>
                </div>
                <button 
                    className="sidebar-close-btn desktop-collapse-toggle" 
                    onClick={onToggleCollapse} 
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <button className="sidebar-close-btn mobile-close-toggle" onClick={onClose} title="Close sidebar">
                    <ChevronLeft size={20} />
                </button>
            </div>

            <button className="new-chat-btn" onClick={createNewThread}>
                <MessageSquarePlus size={18} />
                <span>New Chat</span>
            </button>

            <div className="search-chats-container">
                <div className="search-chats-wrapper">
                    <Search size={14} className="search-chats-icon" />
                    <input 
                        type="text" 
                        placeholder="Search chats"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="sidebar-stats-row">
                <div className="stat-card">
                    <strong>{threads.length}</strong>
                    <span>Chats</span>
                </div>
                <div className="stat-card">
                    <strong>{pinnedThreadIds.length}</strong>
                    <span>Pinned</span>
                </div>
                <div className="stat-card">
                    <strong>{archivedThreadIds.length}</strong>
                    <span>Archived</span>
                </div>
            </div>

            <div className="threads-scroll-area">
                {grouped.map(([groupName, items]) => (
                    <div key={groupName} className="thread-date-group">
                        <h3 className="date-group-heading">{groupName}</h3>
                        <div className="group-threads-list">
                            {items.length === 0 ? (
                                <div className="empty-section-card">
                                    <p>No chats in this section.</p>
                                </div>
                            ) : (
                                items.map(t => {
                                    const id = t._id || t.id;
                                    const isActive = activeThreadId === id;
                                    const isPinned = pinnedThreadIds.includes(id);
                                    const isArchived = archivedThreadIds.includes(id);
                                    const itemTitle = t.title || "Untitled Chat";

                                    return (
                                        <div
                                            key={id}
                                            className={`thread-item-wrapper ${isActive ? "active" : ""}`}
                                            onClick={() => handleSelect(id)}
                                        >
                                            {isEditingId === id ? (
                                                <div className="inline-rename-wrapper" onClick={(e) => e.stopPropagation()}>
                                                    <input 
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === "Enter" && saveRename(e, id)}
                                                        autoFocus
                                                    />
                                                    <button className="rename-confirm-btn" onClick={(e) => saveRename(e, id)}>
                                                        <Check size={12} />
                                                    </button>
                                                    <button className="rename-cancel-btn" onClick={cancelRename}>
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="thread-item-content">
                                                    <div className="thread-main-text">
                                                        <span className="thread-title-text" title={itemTitle}>
                                                            {isPinned && <Pin size={12} className="pinned-indicator-icon" />}
                                                            {itemTitle}
                                                        </span>
                                                        <span className="thread-desc-text">
                                                            {getThreadDescription(itemTitle)}
                                                        </span>
                                                    </div>

                                                    <div className="thread-actions-overlay">
                                                        <button 
                                                            className={`action-btn pin-btn ${isPinned ? "is-active" : ""}`}
                                                            onClick={(e) => togglePin(e, id)}
                                                            title={isPinned ? "Unpin chat" : "Pin chat"}
                                                        >
                                                            <Pin size={12} />
                                                        </button>
                                                        <button 
                                                            className="action-btn rename-btn"
                                                            onClick={(e) => startRename(e, id, itemTitle)}
                                                            title="Rename chat"
                                                        >
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button 
                                                            className={`action-btn archive-btn ${isArchived ? "is-active" : ""}`}
                                                            onClick={(e) => toggleArchive(e, id)}
                                                            title={isArchived ? "Unarchive chat" : "Archive chat"}
                                                        >
                                                            <Archive size={12} />
                                                        </button>
                                                        <button 
                                                            className="action-btn export-btn"
                                                            onClick={(e) => handleExportMarkdown(e, id, itemTitle)}
                                                            title="Export to Markdown"
                                                        >
                                                            <FolderDown size={12} />
                                                        </button>
                                                        <button 
                                                            className="action-btn delete-btn"
                                                            onClick={(e) => handleDelete(e, id)}
                                                            title="Delete chat"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="sidebar-footer">
                {user ? (
                    <div className="user-profile-widget">
                        <div className="user-avatar-small">
                            {avatarInitial}
                        </div>
                        <div className="user-text-info">
                            <span className="user-name-span">{user.fullName}</span>
                            <span className="user-role-span">{user.role || "Student"}</span>
                        </div>
                        <div className="user-actions-row">
                            <button className="footer-utility-btn" title="Settings">
                                <Settings size={14} />
                            </button>
                            <button className="footer-utility-btn logout" onClick={logout} title="Sign Out">
                                <LogOut size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="guest-widget">
                        <UserCircle size={18} />
                        <span>Guest User</span>
                    </div>
                )}
            </div>
        </aside>
    );
}
