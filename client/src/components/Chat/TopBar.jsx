import { FiBell, FiCheckCircle, FiDatabase, FiMessageSquare, FiZap } from "react-icons/fi";

function TopBar({
    currentChat,
    institutionName,
    providerName,
    knowledgeBaseStatus,
    connectionStatus,
    themeControls,
    user,
    unreadCount = 0,
    messageSearch,
    onMessageSearchChange
}) {
    const avatarInitial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || "R";
    const normalizedStatus = String(connectionStatus || "").toLowerCase();

    return (
        <header className="edu-chat-topbar">
            <div className="edu-chat-topbar-copy">
                <div className="edu-chat-topbar-kicker">
                    <span className="edu-chat-section-label">{institutionName}</span>
                    <span className={`edu-chat-status-pill ${normalizedStatus === "online" ? "is-online" : "is-offline"}`}>
                        <FiCheckCircle />
                        {connectionStatus}
                    </span>
                </div>

                <h1>{currentChat}</h1>

                <div className="edu-chat-topbar-badges">
                    <span><FiZap /> {providerName}</span>
                    <span><FiDatabase /> {knowledgeBaseStatus}</span>
                    <span><FiMessageSquare /> Smart search enabled</span>
                </div>
            </div>

            <div className="edu-chat-topbar-tools">
                <label className="edu-chat-message-search">
                    <span>Search messages</span>
                    <input
                        type="search"
                        value={messageSearch}
                        onChange={(event) => onMessageSearchChange(event.target.value)}
                        placeholder="Find in current chat"
                        aria-label="Search messages in current chat"
                    />
                </label>

                <button type="button" className="edu-chat-notification-button" aria-label="Notifications">
                    <FiBell />
                    {unreadCount ? <span>{unreadCount}</span> : null}
                </button>

                <button type="button" className="edu-chat-avatar-button" aria-label="Open profile">
                    {user?.avatar ? <img src={user.avatar} alt="Profile" /> : <span>{avatarInitial}</span>}
                </button>

                {themeControls}
            </div>
        </header>
    );
}

export default TopBar;
