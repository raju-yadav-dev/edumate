import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "katex/dist/katex.min.css";
import "./styles/global.css";
import "./styles/variables.css";
import "./index.css";

import App from "./App";
import AdminAuthProvider from "./context/AdminAuthContext";
import AuthProvider from "./context/AuthContext";
import ThemeProvider from "./context/ThemeContext";

class GlobalErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("[GlobalErrorBoundary] Caught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: "40px",
                    fontFamily: "system-ui, sans-serif",
                    background: "#0f172a",
                    color: "#f8fafc",
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                    <div style={{
                        maxWidth: "600px",
                        background: "#1e293b",
                        padding: "32px",
                        borderRadius: "12px",
                        border: "1px solid #334155",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
                    }}>
                        <h2 style={{ color: "#ef4444", marginTop: 0 }}>EduMate Render Error</h2>
                        <p style={{ color: "#94a3b8" }}>
                            An error occurred while loading this page:
                        </p>
                        <pre style={{
                            background: "#090d16",
                            padding: "16px",
                            borderRadius: "8px",
                            color: "#fca5a5",
                            overflowX: "auto",
                            fontSize: "13px"
                        }}>
                            {this.state.error?.toString() || "Unknown error"}
                            {"\n\n"}
                            {this.state.errorInfo?.componentStack || ""}
                        </pre>
                        <button
                            onClick={() => {
                                localStorage.clear();
                                window.location.reload();
                            }}
                            style={{
                                marginTop: "16px",
                                padding: "10px 18px",
                                background: "#6366f1",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: "600",
                                cursor: "pointer"
                            }}
                        >
                            Clear Cache &amp; Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

window.addEventListener("error", (event) => {
    console.error("[Window Error]", event.message, event.filename, event.lineno, event.error);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Promise Rejection]", event.reason);
});

const rootElement = document.getElementById("root");
if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <GlobalErrorBoundary>
                <ThemeProvider>
                    <AuthProvider>
                        <AdminAuthProvider>
                            <App />
                        </AdminAuthProvider>
                    </AuthProvider>
                </ThemeProvider>
            </GlobalErrorBoundary>
        </StrictMode>
    );
}