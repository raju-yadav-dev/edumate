import "./Navbar.css";

import { Link } from "react-router-dom";
import ThemeToggle from "../ThemeToggle/ThemeToggle";

function Navbar() {

    return (

        <nav className="navbar">

            <div className="logo">
                EduMate
            </div>

            <ul className="nav-links">

                <li>
                    <a href="#home">Home</a>
                </li>

                <li>
                    <a href="#features">Features</a>
                </li>

                <li>
                    <a href="#about">About</a>
                </li>

                <li>
                    <a href="#faq">FAQ</a>
                </li>

                <li>
                    <a href="#contact">Contact</a>
                </li>

            </ul>

            <div className="nav-buttons">

                <ThemeToggle />

                <Link to="/login">
                    <button className="login-btn">
                        Login
                    </button>
                </Link>

            </div>

        </nav>

    );

}

export default Navbar;