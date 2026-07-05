import "./Navbar.css";

import ThemeToggle from "../ThemeToggle/ThemeToggle";

function Navbar() {

    return (

        <nav className="navbar">

            <div className="logo">
                EduMate
            </div>

            <ul className="nav-links">

                <li><a href="#">Home</a></li>

                <li><a href="#features">Features</a></li>

                <li><a href="#about">About</a></li>

                <li><a href="#faq">FAQ</a></li>

                <li><a href="#contact">Contact</a></li>

            </ul>

            <div className="nav-buttons">

                <ThemeToggle />

                <button className="login-btn">
                    Login
                </button>

            </div>

        </nav>

    );

}

export default Navbar;