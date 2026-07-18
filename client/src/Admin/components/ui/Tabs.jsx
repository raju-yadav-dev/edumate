function Tabs({ items = [], active, onChange }) {
    return (
        <div className="ui-tabs">
            {items.map((item) => (
                <button
                    type="button"
                    key={item.value}
                    className={active === item.value ? "active" : ""}
                    onClick={() => onChange(item.value)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export default Tabs;
