import React, { useRef, useEffect } from "react";
import useChat from "../hooks/useChat";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import SuggestedQuestions from "./SuggestedQuestions";
import ChatInput from "./ChatInput";
import EmptyState from "./EmptyState";
import "../styles/ChatWindow.css";

export default function ChatWindow() {
    const { messages, loading, sendMessage, suggestions, regenerate } = useChat();
    const chatEndRef = useRef(null);

    // Auto-scroll to the bottom of the conversation when messages change or loading state toggles
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSelectPrompt = (promptText) => {
        void sendMessage(promptText);
    };

    const hasMessages = messages && messages.length > 0;

    return (
        <section className="chat-window-container">
            <div className="chat-messages-viewport">
                {!hasMessages ? (
                    <EmptyState onSelectPrompt={handleSelectPrompt} />
                ) : (
                    <div className="messages-scroll-wrapper">
                        {messages.map((message, index) => {
                            const isLast = index === messages.length - 1;
                            return (
                                <ChatMessage
                                    key={index}
                                    message={message}
                                    prevMessage={index > 0 ? messages[index - 1] : null}
                                    onRegenerate={regenerate}
                                    isLast={isLast}
                                />
                            );
                        })}

                        {loading && <TypingIndicator />}

                        {/* Show suggested questions only when the last message is from the assistant and we are not loading */}
                        {!loading && messages[messages.length - 1]?.role === "assistant" && (
                            <SuggestedQuestions
                                suggestions={suggestions}
                                onSelectQuestion={handleSelectPrompt}
                            />
                        )}

                        <div ref={chatEndRef} className="scroll-spacer" />
                    </div>
                )}
            </div>

            <footer className="chat-window-footer">
                <ChatInput onSendMessage={sendMessage} disabled={loading} />
            </footer>
        </section>
    );
}
