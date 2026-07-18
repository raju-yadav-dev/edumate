function Table({ children, className = "" }) {
    return (
        <div className={`table ${className}`}>
            {children}
        </div>
    );
}

export default Table;
