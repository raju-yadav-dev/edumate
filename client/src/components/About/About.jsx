import "./About.css";

function About() {
    return (
        <section id="about" className="about">

            <div className="about-image">

                <img
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"
                    alt="Students"
                />

            </div>

            <div className="about-content">

                <h2>About EduMate</h2>

                <p>
                    EduMate is an AI-powered educational assistant designed for
                    schools, colleges, universities, and training institutes.
                    It provides instant, accurate, and context-aware answers
                    from institutional documents using Retrieval-Augmented
                    Generation (RAG).
                </p>

                <div className="about-list">

                    <div>✔ AI Powered Assistance</div>

                    <div>✔ Instant Answers</div>

                    <div>✔ Document Intelligence</div>

                    <div>✔ Multi-language Support</div>

                    <div>✔ Role-based Access</div>

                </div>

            </div>

        </section>
    );
}

export default About;