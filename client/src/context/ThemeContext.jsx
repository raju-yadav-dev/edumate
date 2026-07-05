import { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext();

function ThemeProvider({ children }) {

    const [theme, setTheme] = useState(() => {

        return localStorage.getItem("theme") || "dark";

    });

    useEffect(() => {

        document.documentElement.setAttribute("data-theme", theme);

        localStorage.setItem("theme", theme);

    }, [theme]);

    function toggleTheme() {

        setTheme((prev) => prev === "dark" ? "light" : "dark");

    }

    return (

        <ThemeContext.Provider
            value={{ theme, toggleTheme }}
        >

            {children}

        </ThemeContext.Provider>

    );

}

export default ThemeProvider;