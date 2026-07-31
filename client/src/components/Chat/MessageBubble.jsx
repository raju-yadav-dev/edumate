import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

import { Bot, UserRound } from "lucide-react";

import ConfidenceBadge from "./ConfidenceBadge";
import CitationCard from "./CitationCard";
import MessageActions from "./MessageActions";

function isCitationsOnlyRequest(prevMessage) {
    if (!prevMessage || prevMessage.role !== "user") return false;
    const query = String(prevMessage.content || "").toLowerCase().trim();
    
    return (
        query === "give the supportive document" ||
        query === "give supportive document" ||
        query === "give supportive documents" ||
        query === "show supportive documents" ||
        query === "give the document" ||
        query === "give document" ||
        query === "give documents" ||
        query === "show document" ||
        query === "show documents" ||
        query === "give the source" ||
        query === "give source" ||
        query === "give sources" ||
        query === "show sources" ||
        query === "give source documents" ||
        query === "show source documents" ||
        query === "give pdf" ||
        query === "show pdf" ||
        query === "give pdfs" ||
        query === "show pdfs" ||
        query === "citation" ||
        query === "citations" ||
        query === "reference" ||
        query === "references" ||
        query === "show citation" ||
        query === "show citations" ||
        query === "give citation" ||
        query === "give citations" ||
        query === "show reference" ||
        query === "show references" ||
        query === "give reference" ||
        query === "give references" ||
        query === "give the pdf file" ||
        query === "give the pdf files" ||
        query === "show the pdf file" ||
        query === "show the pdf files" ||
        query.includes("supportive document") ||
        query.includes("supportive doc") ||
        query.startsWith("give document") ||
        query.startsWith("show document") ||
        query.startsWith("give pdf") ||
        query.startsWith("show pdf") ||
        query.startsWith("give source") ||
        query.startsWith("show source")
    );
}

function MessageBubble({
    message,
    prevMessage,
    onCopy,
    onRegenerate,
    onShare,
    onBookmark,
    onRate,
    onExportMarkdown,
    onDownloadPdf
}) {
    const isUser = message.role === "user";
    const showCitations = (() => {
        if (!Array.isArray(message.sources) || message.sources.length === 0) {
            return false;
        }

        if (prevMessage && prevMessage.role === "user") {
            const query = String(prevMessage.content || "").toLowerCase();
            return (
                query.includes("supportive document") ||
                query.includes("supportive doc") ||
                query.includes("give document") ||
                query.includes("show document") ||
                query.includes("give source") ||
                query.includes("show source") ||
                query.includes("citation") ||
                query.includes("reference") ||
                query.includes("where did you get") ||
                query.includes("which document") ||
                query.includes("pdf file") ||
                query.includes("source file") ||
                query.includes("document name") ||
                query.includes("support doc") ||
                query.includes("attached doc")
            );
        }

        return false;
    })();

    const displayContent = (() => {
        if (!isUser && showCitations && isCitationsOnlyRequest(prevMessage)) {
            return "Here are the supportive documents:";
        }
        return message.content;
    })();

    const handleCitationClick = (citation) => {
        if (message.onCitationClick) {
            message.onCitationClick(citation);
            return;
        }

        const url = citation.downloadUrl || (citation.type === "web" || citation.type === "university_website" ? citation.reference : null);
        if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

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
                            {displayContent}
                        </ReactMarkdown>
                    </div>

                    {showCitations ? (
                        <div className="edu-chat-citations">
                            <p className="edu-chat-section-label">Sources</p>
                            <div className="edu-chat-citation-grid">
                                {message.sources.map((citation) => (
                                    <CitationCard key={`${citation.title}-${citation.page}-${citation.section}`} citation={citation} onClick={() => handleCitationClick(citation)} />
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