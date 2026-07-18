function Dropdown({ trigger, children }) {
    return (
        <div className="ui-dropdown">
            {trigger}
            <div className="ui-dropdown-menu">
                {children}
            </div>
        </div>
    );
}

export default Dropdown;
