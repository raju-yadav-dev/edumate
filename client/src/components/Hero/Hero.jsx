import "./Hero.css";
import Button from "../Button/Button";

function Hero() {
    return (
        <section id="home" className="hero-section">

            <div className="hero-content">

                <h1>
                    Your AI Assistant for
                    <span> Educational Institutions</span>
                </h1>

                <p>
                    Get instant answers to admission, fees, academics,
                    hostel, placement, examination, and campus-related
                    questions anytime, anywhere.
                </p>

                <div className="hero-buttons">

                    <Button
                        text="Get Started"
                        type="primary-btn"
                    />

                    <Button
                        text="Learn More"
                        type="secondary-btn"
                    />

                </div>

            </div>

            <div className="hero-visual" aria-hidden="true">

                <div className="floating-orb orb-one"></div>
                <div className="floating-orb orb-two"></div>

                <div className="chat-pill chat-pill-top">
                    View Detailed Bounce Analysis
                </div>

                <div className="chat-card chat-card-summary">
                    <div className="chat-avatar">AI</div>
                    <div className="chat-card-body">
                        <p>
                            Based on recent data, the spike in traffic is primarily
                            from increased referrals from social media and organic search.
                        </p>

                        <div className="mini-file-card">
                            <div className="mini-file-icon">∎</div>
                            <div>
                                <strong>Sample File</strong>
                                <span>Downloads · 500 KB</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="chat-pill chat-pill-bottom">
                    Can you export this as a CSV?
                </div>

                <div className="chat-status-row">
                    <div className="chat-avatar">AI</div>
                    <span>Analyzing data, please wait...</span>
                </div>

                <div className="chat-card chat-card-input">
                    <div className="chat-chip-row">
                        <span>Create in-depth analysis</span>
                        <span>Identify actionable tasks</span>
                    </div>

                    <div className="chat-input-shell">
                        <span>Ask, write or search for anything...</span>
                        <button type="button" aria-label="Send message">→</button>
                    </div>
                </div>

            </div>

        </section>
    );
}

export default Hero;