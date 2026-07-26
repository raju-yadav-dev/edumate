import React, { useState } from "react";
import { 
    Menu, 
    Moon, 
    Sun, 
    Edit3, 
    Check, 
    X, 
    Zap, 
    Database, 
    Search, 
    Plus,
    Layout
} from "lucide-react";
import useChat from "../hooks/useChat";
import useTheme from "../../../hooks/useTheme";
import "../styles/ChatHeader.css";

export default function ChatHeader({ onToggleSidebar, onToggleCollapse }) {
    const { activeThreadId, threads, renameThread, createNewThread } = useChat();
    const { theme, toggleTheme } = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [titleInput, setTitleInput] = useState("");
    const [msgSearchQuery, setMsgSearchQuery] = useState("");

    // Find the title of the active thread
    const activeThread = threads.find(t => (t._id === activeThreadId || t.id === activeThreadId));
    const title = activeThread ? activeThread.title : "New Chat Session";

    const handleStartEdit = () => {
        setTitleInput(title);
        setIsEditing(true);
    };

    const handleSaveRename = () => {
        if (titleInput.trim() && titleInput.trim() !== title) {
            renameThread(activeThreadId, titleInput.trim());
        }
        setIsEditing(false);
    };

    const handleFocusSidebarSearch = () => {
        const sidebarSearchInput = document.querySelector(".search-chats-wrapper input");
        if (sidebarSearchInput) {
            sidebarSearchInput.focus();
        }
    };

    return (
        <header className="chat-header-bar">
            <div className="header-left">
                <button
                    className="mobile-menu-toggle"
                    onClick={onToggleSidebar}
                    title="Open menu"
                >
                    <Menu size={20} />
                </button>

                <div className="header-meta-group">
                    <div className="institute-status-row">
                        <span className="institute-name">EduMate Institute</span>
                        <div className="online-indicator">
                            <span className="dot"></span>
                            <span>Online</span>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="rename-input-wrapper">
                            <input
                                type="text"
                                className="rename-textbox"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveRename()}
                                autoFocus
                            />
                            <button className="rename-confirm-btn" onClick={handleSaveRename}>
                                <Check size={14} />
                            </button>
                            <button className="rename-cancel-btn" onClick={() => setIsEditing(false)}>
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="title-display-wrapper">
                            <h2 className="header-chat-title">{title}</h2>
                            {activeThreadId && (
                                <button
                                    className="rename-trigger-btn"
                                    onClick={handleStartEdit}
                                    title="Rename chat"
                                >
                                    <Edit3 size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="header-badges-row">
                        <span className="header-badge">
                            <Zap size={12} className="badge-icon green" />
                            <span>EduMate Core v3</span>
                        </span>
                        <span className="header-badge">
                            <Database size={12} className="badge-icon" />
                            <span>Knowledge base connected</span>
                        </span>
                        <span className="header-badge">
                            <Search size={12} className="badge-icon" />
                            <span>Smart search enabled</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="header-right">
                <div className="msg-search-container">
                    <span className="msg-search-label">Search messages</span>
                    <div className="msg-search-input-wrapper">
                        <Search size={14} className="msg-search-icon" />
                        <input 
                            type="text" 
                            placeholder="Find in current chat"
                            value={msgSearchQuery}
                            onChange={(e) => setMsgSearchQuery(e.target.value)}
                        />
                        <span className="keyboard-shortcut">Ctrl K</span>
                    </div>
                </div>

                <div className="utility-buttons-row">
                    <button className="header-utility-btn" onClick={createNewThread} title="Start new conversation">
                        <Plus size={14} />
                        <span>New Chat</span>
                    </button>
                    <button className="header-utility-btn" onClick={handleFocusSidebarSearch} title="Search chats">
                        <Search size={14} />
                        <span>Search Chats</span>
                    </button>
                    <button className="header-utility-btn" onClick={onToggleCollapse} title="Toggle sidebar">
                        <Layout size={14} />
                        <span>Sidebar</span>
                    </button>
                </div>

                <div className="theme-capsule-switch" onClick={toggleTheme} title="Toggle Theme">
                    <div className={`switch-capsule ${theme}`}>
                        <div className="switch-knob">
                            {theme === "light" ? <Sun size={10} className="knob-icon" /> : <Moon size={10} className="knob-icon" />}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
