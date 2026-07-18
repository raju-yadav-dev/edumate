function StatCards({ stats = [] }) {

    return (

        <div className="admin-banner-row">

            {stats.map((item) => (

                <div
                    key={item.label}
                    className={`stat-chip tone-${item.tone}`}
                >

                    <div className="stat-icon">

                        <item.Icon size={20} />

                    </div>

                    <div className="stat-copy">

                        <span>{item.label}</span>

                        <strong>{item.value}</strong>

                        <small>{item.note}</small>

                    </div>

                </div>

            ))}

        </div>

    );

}

export default StatCards;