import "./Statistics.css";

function Statistics() {

    const stats = [

    {
        number: "N/A",
        title: "Questions Answered"
    },

    {
        number: "N/A",
        title: "Documents Indexed"
    },

    {
        number: "N/A",
        title: "Educational Institutes"
    },

    {
        number: "99.9%",
        title: "AI Uptime"
    }

];

    return (
        <section className="statistics">

            <div className="statistics-heading">

                <h2>EduMate in Numbers</h2>

                <p>
                    Empowering educational institutions with intelligent AI solutions.
                </p>

            </div>

            <div className="statistics-container">

                {
                    stats.map((item, index) => (

                        <div className="stat-card" key={index}>

                            <h1>{item.number}</h1>

                            <p>{item.title}</p>

                        </div>

                    ))
                }

            </div>

        </section>
    );

}

export default Statistics;