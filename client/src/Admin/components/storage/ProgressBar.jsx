function ProgressBar({ usage = 0, tone = "mongo" }) {
    return (
        <div className={`enterprise-progress ${tone}`}>
            <span
                style={{
                    width: `${Math.min(Number(usage || 0), 100)}%`,
                }}
            />
        </div>
    );
}

export default ProgressBar;