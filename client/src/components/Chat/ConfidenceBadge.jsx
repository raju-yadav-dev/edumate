function ConfidenceBadge({ value = "medium" }) {
    const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : "Medium";

    return (
        <span className={`edu-chat-confidence edu-chat-confidence-${value}`} title={`Confidence: ${label}`}>
            {label}
        </span>
    );
}

export default ConfidenceBadge;