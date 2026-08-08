import { FiArchive, FiChevronLeft, FiChevronRight, FiEdit3, FiFolder, FiLogOut, FiPlus, FiSearch, FiSettings, FiTrash2, FiMapPin } from "react-icons/fi";
import { LiaPaperclipSolid } from "react-icons/lia";

import { Link } from "react-router-dom";

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
    onLogout
}) {
    const avatarInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || "R";

    return (
        <aside className={`edu-chat-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
            <div className="edu-chat-sidebar-shell">
                <div className="edu-chat-brand-row">
                    <Link className="edu-chat-brand" to="/">
                        <span className="edu-chat-brand-mark">E</span>
                        <span className="edu-chat-brand-copy">
                            <strong>EduMate</strong>
                            <small>AI learning assistant</small>
                        </span>
                    </Link>

                    <button type="button" className="edu-chat-icon-button edu-chat-collapse-button" onClick={onToggleCollapse} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                        {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
                    </button>
                </div>

                <button type="button" className="edu-chat-primary-button" onClick={onNewChat}>
                    <FiPlus />
                    <span>New Chat</span>
                </button>

                <label className="edu-chat-search-box">
                    <FiSearch />
                    <input
                        type="search"
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search chats"
                        aria-label="Search chats"
                    />
                </label>

                <div className="edu-chat-sidebar-stats">
                    <article>
                        <strong>{sections.reduce((total, section) => total + section.items.length, 0)}</strong>
                        <span>Chats</span>
                    </article>
                    <article>
                        <strong>{sections.find((section) => section.label === "Pinned")?.items.length || 0}</strong>
                        <span>Pinned</span>
                    </article>
                    <article>
                        <strong>{sections.find((section) => section.label === "Archive")?.items.length || 0}</strong>
                        <span>Archived</span>
                    </article>
                </div>

                <div className="edu-chat-sidebar-sections">
                    {sections.map((section) => {
                        if (section.items.length === 0 && ["Yesterday", "Previous Week", "Archive", "Pinned"].includes(section.label)) {
                            return null;
                        }
                        return (
                            <section className="edu-chat-thread-section" key={section.label}>
                            <div className="edu-chat-section-header">
                                <span>{section.label}</span>
                                <small>{section.items.length}</small>
                            </div>

                            <div className="edu-chat-thread-list">
                                {section.items.length ? section.items.map((thread) => (
                                    <div
                                        key={thread.id}
                                        className={`edu-chat-thread-item ${thread.id === activeThreadId ? "is-active" : ""}`}
                                    >
                                        <button type="button" className="edu-chat-thread-select" onClick={() => onSelectThread(thread.id)}>
                                            <span className="edu-chat-thread-title-row">
                                                {thread.pinned ? <FiMapPin /> : null}
                                                <strong>{thread.title}</strong>
                                            </span>
                                            <span className="edu-chat-thread-preview">{thread.preview}</span>
                                            <span className="edu-chat-thread-meta-row">
                                                <small>{thread.updatedLabel}</small>
                                                {thread.hasFiles ? <LiaPaperclipSolid /> : null}
                                            </span>
                                        </button>

                                        <div className="edu-chat-thread-actions">
                                            <button type="button" onClick={() => onPinThread(thread.id)} aria-label={`Pin ${thread.title}`}>
                                                <FiMapPin />
                                            </button>
                                            <button type="button" onClick={() => onRenameThread(thread.id)} aria-label={`Rename ${thread.title}`}>
                                                <FiEdit3 />
                                            </button>
                                            <button type="button" onClick={() => onArchiveThread(thread.id)} aria-label={`Archive ${thread.title}`}>
                                                <FiArchive />
                                            </button>
                                            <button type="button" onClick={() => onExportThread(thread.id)} aria-label={`Export ${thread.title}`}>
                                                <FiFolder />
                                            </button>
                                            <button type="button" onClick={() => onDeleteThread(thread.id)} aria-label={`Delete ${thread.title}`}>
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="edu-chat-empty-panel">
                                        <p>No chats in this section.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )})}
                </div>

                <div className="edu-chat-sidebar-footer">
                    <Link className="edu-chat-sidebar-link" to="/profile">
                        {user?.avatar ? (
                            <img className="edu-chat-avatar-image" src={user.avatar} alt="Profile" />
                        ) : (
                            <span className="edu-chat-avatar-fallback">{avatarInitial}</span>
                        )}
                        <span>
                            <strong>{isAuthenticated ? user?.fullName || "Profile" : "Guest profile"}</strong>
                            <small>{isAuthenticated ? user?.role || "Member" : "Sign in to sync chats"}</small>
                        </span>
                    </Link>

                    <div className="edu-chat-sidebar-footer-actions">
                        <button type="button" className="edu-chat-footer-action">
                            <FiSettings />
                            <span>Settings</span>
                        </button>
                        {isAuthenticated ? (
                            <button type="button" className="edu-chat-footer-action" onClick={onLogout}>
                                <FiLogOut />
                                <span>Logout</span>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;