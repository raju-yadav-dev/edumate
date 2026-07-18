function Toast({ tone = "success", children }) {
    if (!children) {
        return null;
    }

    return <div className={`status-pill ${tone}`}>{children}</div>;
}

export default Toast;
