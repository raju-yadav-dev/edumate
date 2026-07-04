import "./Hero.css";
import heroImg from "../../assets/hero.png";
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

            <div className="hero-image">

                <img src={heroImg} alt="EduMate Hero" />

            </div>

        </section>
    );
}

export default Hero;