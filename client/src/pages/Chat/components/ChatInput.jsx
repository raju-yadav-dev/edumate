import React, { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft } from "lucide-react";
import "../styles/ChatInput.css";

export default function ChatInput({ onSendMessage, disabled }) {
    const [text, setText] = useState("");
    const textareaRef = useRef(null);

    // Auto-grow textarea height based on content
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }, [text]);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!text.trim() || disabled) return;

        onSendMessage(text.trim());
        setText("");

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    };

    const handleKeyDown = (e) => {
        // Send on Enter (unless Shift key is pressed for new line)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <form className="chat-input-form" onSubmit={handleSubmit}>
            <div className="chat-input-wrapper">
                <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    rows="1"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask EduMate about admissions, fees, hostel rules..."
                    disabled={disabled}
                />
                
                <div className="chat-input-controls">
                    <span className="kb-hint">
                        <CornerDownLeft size={10} /> Enter to send
                    </span>
                    <button
                        type="submit"
                        className="chat-send-button"
                        disabled={!text.trim() || disabled}
                        title="Send message"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </form>
    );
}
