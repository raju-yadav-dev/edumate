import React from "react";
import { Bot } from "lucide-react";

function TypingIndicator({ label = "EduMate is typing" }) {
    return (
        <div className="edu-chat-typing-indicator" role="status" aria-live="polite">
            <style dangerouslySetInnerHTML={{ __html: `
                .edu-chat-typing-indicator {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 18px;
                    align-items: flex-start;
                    animation: eduTypingFadeIn 0.3s ease-out;
                }

                .edu-chat-typing-avatar {
                    width: 36px;
                    height: 36px;
                    flex: 0 0 36px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    background: rgba(15, 23, 42, 0.82);
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    color: #d8ff1f;
                }

                .edu-chat-typing-bubble {
                    padding: 12px 16px;
                    border: 1px solid rgba(148, 163, 184, 0.18);
                    border-radius: 12px;
                    background: rgba(15, 23, 42, 0.74);
                    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: #94a3b8;
                }

                .edu-chat-typing-text {
                    animation: eduTypingPulse 1.6s ease-in-out infinite;
                }

                .edu-chat-typing-dots {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .edu-chat-typing-dots span {
                    width: 5px;
                    height: 5px;
                    background-color: #d8ff1f;
                    border-radius: 50%;
                    opacity: 0.4;
                    display: inline-block;
                    animation: eduTypingBounce 1.4s infinite ease-in-out both;
                }

                .edu-chat-typing-dots span:nth-child(1) {
                    animation-delay: -0.32s;
                }

                .edu-chat-typing-dots span:nth-child(2) {
                    animation-delay: -0.16s;
                }

                [data-theme="light"] .edu-chat-typing-avatar {
                    background: #f1f5f9;
                    border-color: rgba(0, 0, 0, 0.08);
                    color: #0f172a;
                }

                [data-theme="light"] .edu-chat-typing-bubble {
                    background: #ffffff;
                    border-color: rgba(0, 0, 0, 0.08);
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.04);
                    color: #475569;
                }

                [data-theme="light"] .edu-chat-typing-dots span {
                    background-color: #0f172a;
                }

                @keyframes eduTypingFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes eduTypingPulse {
                    0%, 100% {
                        opacity: 0.7;
                    }
                    50% {
                        opacity: 1;
                    }
                }

                @keyframes eduTypingBounce {
                    0%, 80%, 100% {
                        transform: scale(0.7);
                        opacity: 0.4;
                    }
                    40% {
                        transform: scale(1.1) translateY(-3px);
                        opacity: 1;
                    }
                }
            ` }} />
            <div className="edu-chat-typing-avatar" aria-hidden="true">
                <Bot size={16} />
            </div>
            <div className="edu-chat-typing-bubble">
                <span className="edu-chat-typing-text">{label}</span>
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