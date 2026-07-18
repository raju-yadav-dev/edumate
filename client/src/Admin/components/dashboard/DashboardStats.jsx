import "./DashboardStats.css";

import StatCard from "./StatCard";

function DashboardStats({ stats }) {
    return (
        <section className="dashboard-stats">

            {stats.map((item) => (
                <StatCard
                    key={item.label}
                    item={item}
                />
            ))}

        </section>
    );
}

export default DashboardStats;