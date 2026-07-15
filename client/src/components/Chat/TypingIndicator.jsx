function TypingIndicator({ label = "EduMate is typing" }) {
    return (
        <div className="edu-chat-typing-indicator" role="status" aria-live="polite">
            <span className="edu-chat-typing-avatar">AI</span>
            <div className="edu-chat-typing-bubble">
                <span>{label}</span>
                <div className="edu-chat-typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
            </div>
        </div>
    );
}

export default TypingIndicator;