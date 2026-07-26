import { FiFileText, FiGlobe } from "react-icons/fi";

function CitationCard({ citation, onClick }) {
    const isWeb = citation.type === "web" || citation.type === "university_website";

    return (
        <button type="button" className="edu-chat-citation" onClick={onClick}>
            <span className="edu-chat-citation-icon">
                {isWeb ? <FiGlobe /> : <FiFileText />}
            </span>

            <span className="edu-chat-citation-body">
                <strong>{citation.title}</strong>
                {isWeb ? (
                    <span className="citation-web-url" title={citation.reference}>{citation.reference || "Web link"}</span>
                ) : (
                    <span>Page {citation.page || "1"} · {citation.section || "General"}</span>
                )}
            </span>

            <span className="edu-chat-citation-score">
                {citation.similarity ? `${citation.similarity}%` : ""}
            </span>
        </button>
    );
}

export default CitationCard;