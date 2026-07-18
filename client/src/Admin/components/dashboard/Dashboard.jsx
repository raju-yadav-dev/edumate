import "./Dashboard.css";

import StatCards from "./StatCards";

function Dashboard({ stats }) {

    return (

        <section className="dashboard">

            <StatCards stats={stats} />

        </section>

    );

}

export default Dashboard;