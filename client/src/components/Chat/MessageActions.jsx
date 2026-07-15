import { FiBookmark, FiCopy, FiDownload, FiRefreshCw, FiShare2, FiThumbsDown, FiThumbsUp } from "react-icons/fi";

function MessageActions({
    message,
    onCopy,
    onRegenerate,
    onShare,
    onBookmark,
    onRate,
    onExportMarkdown,
    onDownloadPdf
}) {
    return (
        <div className="edu-chat-message-actions">
            <button type="button" onClick={() => onCopy(message)} aria-label="Copy response">
                <FiCopy />
            </button>

            <button type="button" onClick={() => onRate(message, "like")} aria-label="Like response">
                <FiThumbsUp />
            </button>

            <button type="button" onClick={() => onRate(message, "dislike")} aria-label="Dislike response">
                <FiThumbsDown />
            </button>

            <button type="button" onClick={() => onRegenerate(message)} aria-label="Regenerate response">
                <FiRefreshCw />
            </button>

            <button type="button" onClick={() => onShare(message)} aria-label="Share response">
                <FiShare2 />
            </button>

            <button type="button" onClick={() => onBookmark(message)} aria-label="Bookmark response">
                <FiBookmark />
            </button>

            <button type="button" onClick={() => onExportMarkdown(message)} aria-label="Export as markdown">
                <FiDownload />
            </button>

            <button type="button" onClick={() => onDownloadPdf(message)} aria-label="Download printable version">
                <FiDownload />
            </button>
        </div>
    );
}

export default MessageActions;