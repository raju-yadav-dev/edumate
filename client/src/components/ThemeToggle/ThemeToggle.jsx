import "./ThemeToggle.css";

import { useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext";

function ThemeToggle() {

    const { theme, toggleTheme } = useContext(ThemeContext);

    return (

        <button
            type="button"
            className={`theme-toggle ${theme}`}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >

            <div className="toggle-thumb">

                <div className="sun">

                    <div className="sun-core"></div>

                    <span className="ray r1"></span>
                    <span className="ray r2"></span>
                    <span className="ray r3"></span>
                    <span className="ray r4"></span>
                    <span className="ray r5"></span>
                    <span className="ray r6"></span>
                    <span className="ray r7"></span>
                    <span className="ray r8"></span>

                </div>

                <div className="moon">

                    <div className="moon-cut"></div>

                </div>

            </div>

            <span className="star s1"></span>
            <span className="star s2"></span>
            <span className="star s3"></span>
            <span className="star s4"></span>

            <div className="cloud"></div>

        </button>

    );

}

export default ThemeToggle;