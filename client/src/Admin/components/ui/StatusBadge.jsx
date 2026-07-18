function StatusBadge({ status = "unknown", children }) {
    return (
        <span className={`document-status status-${status}`}>
            {children || status}
        </span>
    );
}

export default StatusBadge;
