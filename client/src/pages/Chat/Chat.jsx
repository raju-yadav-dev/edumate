import "./Chat.css";

import { Bot, LogIn, Send, Shield, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { askEduMate } from "../../services/chatService";
import useAuth from "../../hooks/useAuth";

function Chat() {
    const location = useLocation();
    const { isAuthenticated, user } = useAuth();
    const initialPrompt = useMemo(() => new URLSearchParams(location.search).get("q") || "", [location.search]);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Hi, I am EduMate. Ask about admissions, fees, documents, campus routes, or college information. You can continue as a guest or sign in to save chat history."
        }
    ]);
    const [input, setInput] = useState(initialPrompt);
    const [conversationId, setConversationId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [startedFromUrl, setStartedFromUrl] = useState(false);

    const sendMessage = async (question) => {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion || loading) {
            return;
        }

        setInput("");
        setLoading(true);
        setMessages((current) => [
            ...current,
            {
                role: "user",
                content: trimmedQuestion
            }
        ]);

        try {
            const response = await askEduMate({
                question: trimmedQuestion,
                conversationId
            });

            if (response.data?.conversationId) {
                setConversationId(response.data.conversationId);
            }

            setMessages((current) => [
                ...current,
                {
                    role: "assistant",
                    content: response.data?.message || "I could not generate a response.",
                    confidence: response.data?.confidence,
                    sources: response.data?.sources || []
                }
            ]);
        } catch (error) {
            setMessages((current) => [
                ...current,
                {
                    role: "assistant",
                    content: error.message || "EduMate is unavailable right now."
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialPrompt && !startedFromUrl) {
            setStartedFromUrl(true);
            sendMessage(initialPrompt);
        }
    }, [initialPrompt, startedFromUrl]);

    const handleSubmit = (event) => {
        event.preventDefault();
        sendMessage(input);
    };

    return (
        <main className="chat-page">
            <aside className="chat-sidebar">
                <Link className="chat-brand" to="/">
                    <Bot size={22} />
                    <span>EduMate</span>
                </Link>

                <div className="chat-access-panel">
                    <p className="chat-label">Access mode</p>
                    <h2>{isAuthenticated ? "Signed in" : "Guest chat"}</h2>
                    <p>
                        {isAuthenticated
                            ? `Responses can be saved for ${user?.fullName || "your account"}.`
                            : "Ask without signup. Sign in whenever you want saved history and profile features."}
                    </p>
                    {!isAuthenticated ? (
                        <div className="chat-auth-actions">
                            <Link to="/login">
                                <LogIn size={15} />
                                Login
                            </Link>
                            <Link to="/register">
                                <UserRound size={15} />
                                Register
                            </Link>
                        </div>
                    ) : null}
                </div>

                <div className="chat-access-panel">
                    <p className="chat-label">Try asking</p>
                    <button type="button" onClick={() => sendMessage("What is the fee structure of the college?")}>
                        Fee structure
                    </button>
                    <button type="button" onClick={() => sendMessage("How can I reach the college from the nearest railway station?")}>
                        Route guidance
                    </button>
                    <button type="button" onClick={() => sendMessage("Tell me about the college using verified sources.")}>
                        College details
                    </button>
                </div>

                <Link className="admin-entry-link" to="/admin">
                    <Shield size={15} />
                    Admin
                </Link>
            </aside>

            <section className="chat-workspace">
                <div className="chat-topbar">
                    <div>
                        <p className="chat-label">AI educational assistant</p>
                        <h1>Campus Chat</h1>
                    </div>
                    <span>{isAuthenticated ? user?.role : "guest"}</span>
                </div>

                <div className="chat-thread">
                    {messages.map((message, index) => (
                        <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                            <div className="chat-message-avatar">
                                {message.role === "assistant" ? "AI" : "You"}
                            </div>
                            <div className="chat-bubble">
                                <p>{message.content}</p>
                                {message.confidence ? <small>Confidence: {message.confidence}</small> : null}
                            </div>
                        </article>
                    ))}
                    {loading ? (
                        <article className="chat-message assistant">
                            <div className="chat-message-avatar">AI</div>
                            <div className="chat-bubble">
                                <p>Checking trusted sources and preparing the best answer...</p>
                            </div>
                        </article>
                    ) : null}
                </div>

                <form className="chat-composer" onSubmit={handleSubmit}>
                    <input
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask about fees, admissions, routes, hostel, documents..."
                        aria-label="Ask EduMate"
                    />
                    <button type="submit" disabled={loading}>
                        <Send size={18} />
                    </button>
                </form>
            </section>
        </main>
    );
}

export default Chat;
