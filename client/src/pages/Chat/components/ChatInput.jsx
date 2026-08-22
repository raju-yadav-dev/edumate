import { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft, Paperclip, Upload, Smile, X } from "lucide-react";
import "../styles/ChatInput.css";

export default function ChatInput({ onSendMessage, disabled }) {
    const [text, setText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-grow textarea height based on content
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }, [text]);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if ((!text.trim() && !selectedFile) || disabled) return;

        // If file is attached, prepend or append mock text or just send message
        let finalMessage = text.trim();
        if (selectedFile) {
            finalMessage += `\n\n[Attached File: ${selectedFile.name}]`;
        }

        onSendMessage(finalMessage);
        setText("");
        setSelectedFile(null);

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

    const handleFileClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <form className="chat-input-form" onSubmit={handleSubmit}>
            <div className="chat-input-container">
                {selectedFile && (
                    <div className="attached-file-chip">
                        <span className="file-icon">📄</span>
                        <span className="file-name" title={selectedFile.name}>{selectedFile.name}</span>
                        <button type="button" className="remove-file-btn" onClick={handleRemoveFile}>
                            <X size={12} />
                        </button>
                    </div>
                )}

                <div className="chat-composer-row">
                    <input 
                        type="file"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                    />

                    <div className="composer-actions-left">
                        <button 
                            type="button" 
                            className="composer-action-btn" 
                            title="Add emoji"
                            onClick={() => setText(prev => prev + "😊")}
                        >
                            <Smile size={16} />
                        </button>
                        <button 
                            type="button" 
                            className="composer-action-btn" 
                            title="Attach document"
                            onClick={handleFileClick}
                        >
                            <Paperclip size={16} />
                        </button>
                        <button 
                            type="button" 
                            className="composer-action-btn" 
                            title="Upload university resource"
                            onClick={handleFileClick}
                        >
                            <Upload size={16} />
                        </button>
                    </div>

                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        rows="1"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything about your institution..."
                        disabled={disabled}
                    />
                    
                    <button
                        type="submit"
                        className="chat-send-button"
                        disabled={(!text.trim() && !selectedFile) || disabled}
                        title="Send message"
                    >
                        <Send size={14} />
                        <span>Send</span>
                    </button>
                </div>
            </div>
            <div className="chat-input-help-line">
                <span className="kb-hint">
                    <CornerDownLeft size={10} /> Enter to send • Shift + Enter for new line
                </span>
            </div>
        </form>
    );
}
