import { FiFileText } from "react-icons/fi";

function CitationCard({ citation, onClick }) {
    return (
        <button type="button" className="edu-chat-citation" onClick={onClick}>
            <span className="edu-chat-citation-icon">
                <FiFileText />
            </span>

            <span className="edu-chat-citation-body">
                <strong>{citation.title}</strong>
                <span>Page {citation.page} · {citation.section}</span>
            </span>

            <span className="edu-chat-citation-score">
                {citation.similarity}%
            </span>
        </button>
    );
}

export default CitationCard;