function Tooltip({ label, children }) {
    return (
        <span className="ui-tooltip" data-tooltip={label}>
            {children}
        </span>
    );
}

export default Tooltip;
