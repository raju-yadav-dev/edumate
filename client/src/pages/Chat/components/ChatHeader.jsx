import React, { useState } from "react";
import { Menu, Moon, Sun, Edit3, Check, X } from "lucide-react";
import useChat from "../hooks/useChat";
import useTheme from "../../../hooks/useTheme";
import "../styles/ChatHeader.css";

export default function ChatHeader({ onToggleSidebar }) {
    const { activeThreadId, threads, renameThread, isAuthenticated } = useChat();
    const { theme, toggleTheme } = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [titleInput, setTitleInput] = useState("");

    // Find the title of the active thread
    const activeThread = threads.find(t => (t._id === activeThreadId || t.id === activeThreadId));
    const title = activeThread ? activeThread.title : "New chat";

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

    return (
        <header className="chat-header-bar">
            <div className="header-left">
                <button
                    className="mobile-menu-toggle"
                    onClick={onToggleSidebar}
                    title="Open sidebar"
                >
                    <Menu size={20} />
                </button>

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
            </div>

            <div className="header-right">
                {isAuthenticated ? (
                    <span className="auth-status-pill authenticated">Saved to Cloud</span>
                ) : (
                    <span className="auth-status-pill guest">Guest Mode</span>
                )}
                
                <button
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                    title="Toggle Theme"
                >
                    {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </button>
            </div>
        </header>
    );
}
