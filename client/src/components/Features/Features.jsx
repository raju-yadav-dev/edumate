import "./Features.css";

function Features() {

    const features = [
        {
            title: "🤖 AI Chatbot",
            description: "Ask questions naturally and receive instant AI-powered answers."
        },
        {
            title: "📄 Document Search",
            description: "Search fee structures, notices, syllabi, and other uploaded documents."
        },
        {
            title: "🌍 Multilingual",
            description: "Supports multiple languages for better accessibility."
        },
        {
            title: "⚡ Fast Response",
            description: "Get accurate answers within seconds using AI."
        },
        {
            title: "📚 Knowledge Base",
            description: "Upload and manage institutional documents easily."
        },
        {
            title: "📊 Analytics",
            description: "Track popular questions and user interactions."
        }
    ];

    return (

        <section id="features" className="features">

            <h2>Why Choose EduMate?</h2>

            <p className="section-text">
                Smart AI-powered assistance for educational institutions.
            </p>

            <div className="feature-container">

                {features.map((feature, index) => (

                    <div className="feature-card" key={index}>

                        <h3>{feature.title}</h3>

                        <p>{feature.description}</p>

                    </div>

                ))}

            </div>

        </section>

    );

}

export default Features;