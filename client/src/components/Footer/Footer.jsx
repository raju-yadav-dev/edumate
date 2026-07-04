import "./Footer.css";

function Footer() {

    return (

        <footer className="footer">

            <div className="footer-container">

                <div className="footer-section">

                    <h2>EduMate</h2>

                    <p>
                        Your AI Assistant for Educational Institutions.
                        Empowering students, teachers, and administrators
                        with intelligent document-based assistance.
                    </p>

                </div>

                <div className="footer-section">

                    <h3>Quick Links</h3>

                    <ul>

                        <li><a href="#">Home</a></li>

                        <li><a href="#">About</a></li>

                        <li><a href="#">Features</a></li>

                        <li><a href="#">Contact</a></li>

                    </ul>

                </div>

                <div className="footer-section">

                    <h3>Services</h3>

                    <ul>

                        <li>AI Chatbot</li>

                        <li>Semantic Search</li>

                        <li>Document Intelligence</li>

                        <li>Analytics</li>

                    </ul>

                </div>

                <div className="footer-section">

                    <h3>Connect</h3>

                    <div className="social-links">

                        <a href="#">🌐</a>

                        <a href="#">📘</a>

                        <a href="#">💼</a>

                        <a href="#">📸</a>

                    </div>

                </div>

            </div>

            <hr />

            <div className="footer-bottom">

                <p>
                    © 2026 EduMate. All Rights Reserved.
                </p>

            </div>

        </footer>

    );

}

export default Footer;