function StatCard({ item }) {
    return (
        <div className={`stat-chip tone-${item.tone}`}>
            <div className="stat-icon">
                <item.Icon size={20} />
            </div>
            <div className="stat-copy">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
            </div>
        </div>
    );
}

export default StatCard;
