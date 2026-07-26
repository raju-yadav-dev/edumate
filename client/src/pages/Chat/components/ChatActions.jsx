import React, { useState } from "react";
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import "../styles/ChatActions.css";

export default function ChatActions({ text, onRegenerate, showRegenerate = false }) {
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text:", err);
        }
    };

    const handleFeedback = (type) => {
        setFeedback(prev => (prev === type ? null : type));
        // Here you can hook up feedback logging API if needed in the future
    };

    return (
        <div className="chat-actions-bar">
            <button
                className="action-button"
                onClick={handleCopy}
                title="Copy response"
            >
                {copied ? <Check className="icon-success" size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {showRegenerate && onRegenerate && (
                <button
                    className="action-button"
                    onClick={onRegenerate}
                    title="Regenerate response"
                >
                    <RotateCcw size={14} />
                    <span>Regenerate</span>
                </button>
            )}

            <span className="action-divider" />

            <button
                className={`feedback-button ${feedback === "like" ? "liked" : ""}`}
                onClick={() => handleFeedback("like")}
                title="Helpful response"
            >
                <ThumbsUp size={14} />
            </button>

            <button
                className={`feedback-button ${feedback === "dislike" ? "disliked" : ""}`}
                onClick={() => handleFeedback("dislike")}
                title="Unhelpful response"
            >
                <ThumbsDown size={14} />
            </button>
        </div>
    );
}
