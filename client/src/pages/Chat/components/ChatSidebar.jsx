import React from "react";
import { MessageSquarePlus, Trash2, LogOut, ChevronLeft, GraduationCap, UserCircle } from "lucide-react";
import useChat from "../hooks/useChat";
import useAuth from "../../../hooks/useAuth";
import "../styles/ChatSidebar.css";

export default function ChatSidebar({ isOpen, onClose }) {
    const { threads, activeThreadId, selectThread, createNewThread, deleteThread } = useChat();
    const { user, logout } = useAuth();
    const [threadToDelete, setThreadToDelete] = React.useState(null);

    // Helper to group threads by date
    const getGroupedThreads = () => {
        const groups = {
            "Today": [],
            "Yesterday": [],
            "Previous Week": [],
            "Older": []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        threads.forEach(t => {
            const date = new Date(t.updatedAt || t.createdAt);
            if (date >= startOfToday) {
                groups["Today"].push(t);
            } else if (date >= yesterday) {
                groups["Yesterday"].push(t);
            } else if (date >= sevenDaysAgo) {
                groups["Previous Week"].push(t);
            } else {
                groups["Older"].push(t);
            }
        });

        return Object.entries(groups).filter(([_, list]) => list.length > 0);
    };

    const grouped = getGroupedThreads();

    const handleSelect = (id) => {
        selectThread(id);
        if (onClose) onClose(); // close drawer on mobile
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        setThreadToDelete(id);
    };

    return (
        <>
            <aside className={`chat-sidebar-drawer ${isOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <GraduationCap className="brand-logo" size={24} />
                        <span>EduMate Chat</span>
                    </div>
                    <button className="sidebar-close-btn" onClick={onClose} title="Close sidebar">
                        <ChevronLeft size={20} />
                    </button>
                </div>

                <button className="new-chat-btn" onClick={createNewThread}>
                    <MessageSquarePlus size={18} />
                    <span>New Conversation</span>
                </button>

                <div className="threads-scroll-area">
                    {threads.length === 0 ? (
                        <div className="empty-threads-placeholder">
                            <p>No recent conversations.</p>
                        </div>
                    ) : (
                        grouped.map(([groupName, items]) => (
                            <div key={groupName} className="thread-date-group">
                                <h3 className="date-group-heading">{groupName}</h3>
                                <div className="group-threads-list">
                                    {items.map(t => {
                                        const id = t._id || t.id;
                                        const isActive = activeThreadId === id;
                                        return (
                                            <button
                                                key={id}
                                                className={`thread-item-row ${isActive ? "active" : ""}`}
                                                onClick={() => handleSelect(id)}
                                            >
                                                <span className="thread-title-text" title={t.title}>
                                                    {t.title || "Untitled Chat"}
                                                </span>
                                                
                                                <button
                                                    className="thread-delete-btn"
                                                    onClick={(e) => handleDelete(e, id)}
                                                    title="Delete thread"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="sidebar-footer">
                    {user ? (
                        <div className="user-profile-widget">
                            <div className="user-avatar-small">
                                {user.fullName ? user.fullName[0].toUpperCase() : "U"}
                            </div>
                            <div className="user-text-info">
                                <span className="user-name-span">{user.fullName}</span>
                                <span className="user-role-span">{user.role || "Student"}</span>
                            </div>
                            <button className="user-logout-btn" onClick={logout} title="Sign Out">
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="guest-widget">
                            <UserCircle size={20} />
                            <span>Guest User</span>
                        </div>
                    )}
                </div>
            </aside>

            {threadToDelete !== null && (
                <div className="sidebar-modal-overlay" onClick={() => setThreadToDelete(null)}>
                    <div className="confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Conversation</h3>
                        <p>Are you sure you want to delete this chat thread? This action cannot be undone.</p>
                        <div className="confirm-modal-actions">
                            <button 
                                className="cancel-btn"
                                onClick={() => setThreadToDelete(null)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="delete-confirm-btn"
                                onClick={() => {
                                    deleteThread(threadToDelete);
                                    setThreadToDelete(null);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
