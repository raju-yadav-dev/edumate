import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/global.css";
import "./styles/variables.css";
import "./index.css";

import App from "./App";
import AdminAuthProvider from "./context/AdminAuthContext";
import AuthProvider from "./context/AuthContext";
import ThemeProvider from "./context/ThemeContext";

createRoot(document.getElementById("root")).render(

    <StrictMode>

        <ThemeProvider>

            <AuthProvider>

                    <AdminAuthProvider>

                        <App />

                    </AdminAuthProvider>

            </AuthProvider>

        </ThemeProvider>

    </StrictMode>

);