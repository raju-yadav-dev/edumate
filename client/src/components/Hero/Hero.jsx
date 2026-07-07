import "./Hero.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../Button/Button";

function Hero() {
    const [heroPrompt, setHeroPrompt] = useState("");
    const navigate = useNavigate();

    const openChat = (prompt = "") => {
        const trimmedPrompt = prompt.trim();

        navigate(trimmedPrompt ? `/chat?q=${encodeURIComponent(trimmedPrompt)}` : "/chat");
    };

    const handlePromptSubmit = (event) => {
        event.preventDefault();
        openChat(heroPrompt);
    };

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
                        onClick={() => openChat()}
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

                    <form className="chat-input-shell" onSubmit={handlePromptSubmit}>
                        <input
                            type="text"
                            value={heroPrompt}
                            onChange={(event) => setHeroPrompt(event.target.value)}
                            onFocus={() => {
                                if (!heroPrompt) {
                                    setHeroPrompt("What is the fee structure of the college?");
                                }
                            }}
                            placeholder="Ask, write or search for anything..."
                            aria-label="Ask EduMate"
                        />
                        <button type="submit" aria-label="Send message">→</button>
                    </form>
                </div>

            </div>

        </section>
    );
}

export default Hero;
