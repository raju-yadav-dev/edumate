import { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext();

const THEME_STORAGE_KEY = "edumate-theme";

function getSystemTheme() {
    if (typeof window === "undefined" || !window.matchMedia) {
        return "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
    }

    return getSystemTheme();
}

function ThemeProvider({ children }) {

    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {

        document.documentElement.setAttribute("data-theme", theme);

        localStorage.setItem(THEME_STORAGE_KEY, theme);

    }, [theme]);

    useEffect(() => {
        if (localStorage.getItem(THEME_STORAGE_KEY)) {
            return;
        }

        if (typeof window === "undefined" || !window.matchMedia) {
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = (event) => {
            setTheme(event.matches ? "dark" : "light");
        };

        handleChange(mediaQuery);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener("change", handleChange);
        } else {
            mediaQuery.addListener(handleChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener("change", handleChange);
            } else {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

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