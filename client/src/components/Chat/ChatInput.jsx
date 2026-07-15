import { useEffect, useRef } from "react";

import { FiArrowRight, FiPaperclip, FiSmile, FiUpload, FiX } from "react-icons/fi";

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
    onChange,
    onSubmit,
    isLoading,
    onStopGenerating,
    onAttachFiles,
    onAddEmoji,
    onClear,
    attachments,
    onRemoveAttachment
}) {
    const textareaRef = useRef(null);
    const attachRef = useRef(null);
    const imageRef = useRef(null);

    useEffect(() => {
        const textarea = textareaRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }, [value]);

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit();
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
        }
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
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
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

                        <button type="button" className="edu-chat-icon-button" onClick={onAddEmoji} aria-label="Insert emoji">
                            <FiSmile />
                        </button>

                        <button type="button" className="edu-chat-icon-button" onClick={onClear} aria-label="Clear input">
                            <FiX />
                        </button>
                    </div>

                    <div className="edu-chat-composer-hints">
                        <span>Enter to send</span>
                        <span>Shift + Enter for new line</span>
                    </div>

                    <button type="submit" className="edu-chat-send-button" disabled={isLoading || !value.trim()}>
                        <FiArrowRight />
                        <span>Send</span>
                    </button>

                    {isLoading ? (
                        <button type="button" className="edu-chat-stop-button" onClick={onStopGenerating}>
                            Stop generating
                        </button>
                    ) : null}
                </div>
            </div>

            <input ref={attachRef} type="file" hidden multiple onChange={handleAttachmentChange} accept=".pdf,.docx,.doc,.txt,.md,.markdown" />
            <input ref={imageRef} type="file" hidden multiple onChange={handleImageChange} accept="image/*" />
        </form>
    );
}

export default ChatInput;