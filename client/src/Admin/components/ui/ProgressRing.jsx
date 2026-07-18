function ProgressRing({ value = 0, label }) {
    return (
        <span
            className="ui-progress-ring"
            style={{ "--progress": `${Math.min(Math.max(Number(value || 0), 0), 100)}%` }}
            aria-label={label}
        >
            <span>{Math.round(Number(value || 0))}%</span>
        </span>
    );
}

export default ProgressRing;
