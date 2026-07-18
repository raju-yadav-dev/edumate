function EmptyState({ title = "No data", description = "Nothing to show yet." }) {
    return (
        <div className="empty-state">
            <div>
                <strong>{title}</strong>
                <p>{description}</p>
            </div>
        </div>
    );
}

export default EmptyState;
