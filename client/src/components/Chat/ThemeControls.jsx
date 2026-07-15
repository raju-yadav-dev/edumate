import ThemeToggle from "../ThemeToggle/ThemeToggle";

function ThemeControls({ theme, onToggleSidebar, onFocusSearch, onNewChat }) {
    return (
        <div className="edu-chat-topbar-actions">
            <button type="button" className="edu-chat-secondary-button" onClick={onNewChat}>New Chat</button>
            <button type="button" className="edu-chat-secondary-button" onClick={onFocusSearch}>Search Chats</button>
            <button type="button" className="edu-chat-secondary-button" onClick={onToggleSidebar}>Sidebar</button>
            <ThemeToggle theme={theme} />
        </div>
    );
}

export default ThemeControls;