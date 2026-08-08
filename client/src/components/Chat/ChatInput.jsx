import { useEffect, useRef, useState } from "react";

import { FiArrowRight, FiPaperclip, FiSmile, FiUpload, FiX, FiSquare, FiMic, FiVolume2 } from "react-icons/fi";

import FilePreview from "./FilePreview";

function formatSize(size) {
    if (!size) {
        return "0 KB";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function ChatInput({
    value,
    onSubmit,
    isLoading,
    onStopGenerating,
    onAttachFiles,
    onClear,
    attachments,
    onRemoveAttachment,
    onVoiceSingleClick,
    onVoiceContinuousClick,
    isVoiceSingleActive,
    isVoiceContinuousActive
}) {
    const [text, setText] = useState(value || "");
    const textareaRef = useRef(null);
    const attachRef = useRef(null);
    const imageRef = useRef(null);

    const [prevValue, setPrevValue] = useState(value);

    if (value !== prevValue) {
        setPrevValue(value);
        setText(value || "");
    }

    useEffect(() => {
        const textarea = textareaRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }, [text]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if ((!text.trim() && attachments.length === 0) || isLoading) return;
        onSubmit(text);
        setText("");
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!isLoading && (text.trim() || attachments.length > 0)) {
                onSubmit(text);
                setText("");
            }
        }
    };

    const handleClear = () => {
        setText("");
        if (onClear) {
            onClear();
        }
    };

    const handleAddEmoji = () => {
        setText((prev) => `${prev}${prev ? " " : ""}😊`);
    };

    const handleAttachmentChange = (event) => {
        const files = Array.from(event.target.files || []);

        if (files.length) {
            onAttachFiles(files);
        }

        event.target.value = "";
    };

    const handleImageChange = (event) => {
        const files = Array.from(event.target.files || []);

        if (files.length) {
            onAttachFiles(files);
        }

        event.target.value = "";
    };

    return (
        <form className="edu-chat-composer" onSubmit={handleSubmit}>
            <FilePreview files={attachments.map((file) => ({ ...file, sizeLabel: formatSize(file.size) }))} onRemove={onRemoveAttachment} />

            <div className="edu-chat-composer-shell">
                <label className="edu-chat-compose-label" htmlFor="edu-chat-input">
                    Ask anything about your institution...
                </label>

                <textarea
                    id="edu-chat-input"
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your institution..."
                    aria-label="Ask anything about your institution"
                    rows={1}
                />

                <div className="edu-chat-composer-actions">
                    <div className="edu-chat-composer-toolbar">
                        <button type="button" className="edu-chat-icon-button" onClick={() => attachRef.current?.click()} aria-label="Attach file">
                            <FiPaperclip />
                        </button>

                        <button type="button" className="edu-chat-icon-button" onClick={() => imageRef.current?.click()} aria-label="Upload image">
                            <FiUpload />
                        </button>

                        <button type="button" className="edu-chat-icon-button" onClick={handleAddEmoji} aria-label="Insert emoji">
                            <FiSmile />
                        </button>

                        {text && (
                            <button type="button" className="edu-chat-icon-button" onClick={handleClear} aria-label="Clear input">
                                <FiX />
                            </button>
                        )}

                        <button
                            type="button"
                            className={`edu-chat-icon-button voice-btn-single ${isVoiceSingleActive ? "is-active" : ""}`}
                            onClick={() => {
                                const isSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
                                if (!isSupported) {
                                    alert("Speech recognition is not supported in Firefox. Please use Google Chrome or Microsoft Edge for voice features!");
                                    return;
                                }
                                onVoiceSingleClick();
                            }}
                            title="Voice Message"
                            aria-label="Voice Message"
                            style={{
                                ...(isVoiceSingleActive ? { color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)" } : {}),
                                ...((typeof window !== "undefined" && !(window.SpeechRecognition || window.webkitSpeechRecognition)) ? { opacity: 0.4, cursor: "not-allowed" } : {})
                            }}
                        >
                            <FiMic />
                        </button>

                        <button
                            type="button"
                            className={`edu-chat-icon-button voice-btn-continuous ${isVoiceContinuousActive ? "is-active" : ""}`}
                            onClick={() => {
                                const isSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
                                if (!isSupported) {
                                    alert("Speech recognition is not supported in Firefox. Please use Google Chrome or Microsoft Edge for voice features!");
                                    return;
                                }
                                onVoiceContinuousClick();
                            }}
                            title="Voice Conversation"
                            aria-label="Voice Conversation"
                            style={{
                                ...(isVoiceContinuousActive ? { color: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)" } : {}),
                                ...((typeof window !== "undefined" && !(window.SpeechRecognition || window.webkitSpeechRecognition)) ? { opacity: 0.4, cursor: "not-allowed" } : {})
                            }}
                        >
                            <FiVolume2 />
                        </button>
                    </div>

                    <div className="edu-chat-composer-hints">
                        <span>Enter to send</span>
                        <span>Shift + Enter for new line</span>
                    </div>

                    {isLoading ? (
                        <button
                            type="button"
                            className="edu-chat-send-button is-stop"
                            onClick={onStopGenerating}
                            title="Stop generating"
                        >
                            <FiSquare style={{ fill: "currentColor" }} />
                            <span>Stop</span>
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="edu-chat-send-button"
                            disabled={!text.trim() && attachments.length === 0}
                            title="Send message"
                        >
                            <FiArrowRight />
                            <span>Send</span>
                        </button>
                    )}
                </div>
            </div>

            <input ref={attachRef} type="file" hidden multiple onChange={handleAttachmentChange} accept=".pdf,.docx,.doc,.txt,.md,.markdown" />
            <input ref={imageRef} type="file" hidden multiple onChange={handleImageChange} accept="image/*" />
        </form>
    );
}

export default ChatInput;