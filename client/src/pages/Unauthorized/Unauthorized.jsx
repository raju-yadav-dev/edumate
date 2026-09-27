import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import "./Unauthorized.css";

export default function Unauthorized() {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="unauthorized-container">
            <div className="unauthorized-card">
                <div className="unauthorized-icon-box">
                    <ShieldAlert size={48} />
                </div>
                <h1 className="unauthorized-title">Access Denied</h1>
                <p className="unauthorized-desc">
                    You do not have permission to view this page. Your current account role is{" "}
                    <span className="unauthorized-role-badge">{user?.role || "Student"}</span>.
                </p>
                <div className="unauthorized-actions">
                    <button
                        type="button"
                        className="unauthorized-btn secondary"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={16} />
                        Go Back
                    </button>
                    <Link to="/" className="unauthorized-btn primary">
                        <Home size={16} />
                        Return to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
