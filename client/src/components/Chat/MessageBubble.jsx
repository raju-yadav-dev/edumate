import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

import { Bot, UserRound } from "lucide-react";

import ConfidenceBadge from "./ConfidenceBadge";
import CitationCard from "./CitationCard";
import MessageActions from "./MessageActions";

function MessageBubble({
    message,
    onCopy,
    onRegenerate,
    onShare,
    onBookmark,
    onRate,
    onExportMarkdown,
    onDownloadPdf
}) {
    const isUser = message.role === "user";
    const hasCitations = Array.isArray(message.sources) && message.sources.length > 0;

    return (
        <article className={`edu-chat-message ${isUser ? "edu-chat-message-user" : "edu-chat-message-assistant"}`}>
            <div className="edu-chat-message-avatar" aria-hidden="true">
                {isUser ? <UserRound size={16} /> : <Bot size={16} />}
            </div>

            <div className="edu-chat-message-body">
                <div className="edu-chat-message-panel">
                    <div className="edu-chat-message-meta">
                        <strong>{isUser ? "You" : "EduMate"}</strong>
                        <span>{message.timestamp}</span>
                        {message.confidence ? <ConfidenceBadge value={message.confidence} /> : null}
                        {message.bookmarked ? <span className="edu-chat-bookmark-pill">Bookmarked</span> : null}
                        {message.reaction ? <span className={`edu-chat-reaction-pill edu-chat-reaction-${message.reaction}`}>{message.reaction}</span> : null}
                    </div>

                    <div className={`edu-chat-markdown ${isUser ? "edu-chat-markdown-user" : ""}`}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeHighlight]}
                            components={{
                                code({ inline, className, children, ...props }) {
                                    const languageMatch = /language-(\w+)/.exec(className || "");
                                    const languageLabel = languageMatch?.[1] || "code";

                                    if (inline) {
                                        return <code className="edu-chat-inline-code" {...props}>{children}</code>;
                                    }

                                    return (
                                        <pre className="edu-chat-code-block" {...props}>
                                            <div className="edu-chat-code-header">{languageLabel}</div>
                                            <code className={className}>{children}</code>
                                        </pre>
                                    );
                                },
                                table({ children }) {
                                    return <div className="edu-chat-table-wrap"><table>{children}</table></div>;
                                },
                                th({ children }) {
                                    return <th>{children}</th>;
                                },
                                td({ children }) {
                                    return <td>{children}</td>;
                                },
                                img({ src, alt }) {
                                    return <img className="edu-chat-inline-image" src={src} alt={alt} />;
                                }
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>

                    {hasCitations ? (
                        <div className="edu-chat-citations">
                            <p className="edu-chat-section-label">Sources</p>
                            <div className="edu-chat-citation-grid">
                                {message.sources.map((citation) => (
                                    <CitationCard key={`${citation.title}-${citation.page}-${citation.section}`} citation={citation} onClick={() => message.onCitationClick?.(citation)} />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {!isUser ? (
                        <MessageActions
                            message={message}
                            onCopy={onCopy}
                            onRegenerate={onRegenerate}
                            onShare={onShare}
                            onBookmark={onBookmark}
                            onRate={onRate}
                            onExportMarkdown={onExportMarkdown}
                            onDownloadPdf={onDownloadPdf}
                        />
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default MessageBubble;