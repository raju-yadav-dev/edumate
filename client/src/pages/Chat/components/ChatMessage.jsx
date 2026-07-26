import React from "react";
import { GraduationCap, User } from "lucide-react";
import SourceCitation from "./SourceCitation";
import ChatActions from "./ChatActions";
import "../styles/ChatMessage.css";

// Helper to escape HTML tags for XSS prevention
function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Custom parser to format bold, code blocks, lists, and tables safely
function parseMarkdown(text) {
    if (!text) return "";

    const lines = text.split("\n");
    const parsedLines = [];
    let inList = false;
    let inTable = false;

    // Helper for formatting inline elements (bold, code)
    const parseInline = (str) => {
        return escapeHtml(str)
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/`([^`]+)`/g, "<code class='chat-inline-code'>$1</code>");
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 1. Code blocks: ```code```
        if (line.trim().startsWith("```")) {
            const codeLines = [];
            i++; // skip header line
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(escapeHtml(lines[i]));
                i++;
            }
            parsedLines.push(`<pre class="chat-code-block"><code>${codeLines.join("\n")}</code></pre>`);
            continue;
        }

        // 2. Unordered lists: - item or * item
        if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
            if (!inList) {
                parsedLines.push("<ul class='chat-list'>");
                inList = true;
            }
            const item = line.trim().replace(/^[-*]\s+/, "");
            parsedLines.push(`<li>${parseInline(item)}</li>`);
            continue;
        } else if (inList) {
            parsedLines.push("</ul>");
            inList = false;
        }

        // 3. Tables: | Header | Header |
        if (line.trim().startsWith("|")) {
            const cells = line.split("|").map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (line.includes("---")) {
                // Table divider, skip
                continue;
            }
            if (!inTable) {
                inTable = true;
                parsedLines.push("<div class='chat-table-wrapper'><table class='chat-table'><thead>");
                parsedLines.push("<tr>" + cells.map(c => `<th>${parseInline(c)}</th>`).join("") + "</tr>");
                parsedLines.push("</thead><tbody>");
            } else {
                parsedLines.push("<tr>" + cells.map(c => `<td>${parseInline(c)}</td>`).join("") + "</tr>");
            }
            continue;
        } else if (inTable) {
            parsedLines.push("</tbody></table></div>");
            inTable = false;
        }

        // 4. Headers: ### Title, ## Title, # Title
        if (line.trim().startsWith("### ")) {
            parsedLines.push(`<h3>${parseInline(line.replace("### ", ""))}</h3>`);
        } else if (line.trim().startsWith("## ")) {
            parsedLines.push(`<h2>${parseInline(line.replace("## ", ""))}</h2>`);
        } else if (line.trim().startsWith("# ")) {
            parsedLines.push(`<h1>${parseInline(line.replace("# ", ""))}</h1>`);
        } else {
            // 5. Normal paragraphs or spacing
            if (line.trim()) {
                parsedLines.push(`<p>${parseInline(line)}</p>`);
            } else {
                parsedLines.push("<div class='chat-spacing'></div>");
            }
        }
    }

    if (inList) parsedLines.push("</ul>");
    if (inTable) parsedLines.push("</tbody></table></div>");

    return parsedLines.join("");
}

export default function ChatMessage({ message, onRegenerate, isLast }) {
    const isAssistant = message.role === "assistant";
    const formattedContent = parseMarkdown(message.content);

    return (
        <div className={`chat-message-bubble-wrapper ${isAssistant ? "assistant" : "user"}`}>
            <div className={`message-avatar ${isAssistant ? "assistant" : "user"}`}>
                {isAssistant ? <GraduationCap size={18} /> : <User size={18} />}
            </div>

            <div className="message-content-container">
                <div className={`message-bubble-body ${isAssistant ? "assistant" : "user"}`}>
                    <div
                        className="message-rich-text"
                        dangerouslySetInnerHTML={{ __html: formattedContent }}
                    />
                    
                    {isAssistant && message.sources && message.sources.length > 0 && (
                        <SourceCitation sources={message.sources} />
                    )}
                </div>

                {isAssistant && (
                    <ChatActions
                        text={message.content}
                        onRegenerate={onRegenerate}
                        showRegenerate={isLast}
                    />
                )}
            </div>
        </div>
    );
}
