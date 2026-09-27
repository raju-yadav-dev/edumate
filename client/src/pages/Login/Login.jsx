import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { Loader2, AlertCircle } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import "./Login.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [generalError, setGeneralError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { login, sessionError } = useAuth();

    const validateForm = () => {
        const errors = {};
        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            errors.email = "Email address is required.";
        } else if (!emailPattern.test(trimmedEmail)) {
            errors.email = "Please enter a valid email address.";
        }

        if (!password) {
            errors.password = "Password is required.";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setGeneralError("");

        if (!validateForm()) return;

        setLoading(true);

        try {
            await login({
                email: email.trim(),
                password
            });

            // Redirect back to intended page or home
            const destination = location.state?.from?.pathname || "/";
            navigate(destination, { replace: true });
        } catch (err) {
            let msg = err.message || "Unable to sign in.";
            if (err.code === "RATE_LIMIT_EXCEEDED") {
                msg = `Too many failed attempts. Please retry in ${err.retryAfterSeconds || 60} seconds.`;
            } else if (err.code === "ACCOUNT_LOCKED") {
                msg = err.message || "Account is temporarily locked. Please try again later.";
            } else if (err.code === "INVALID_CREDENTIALS") {
                msg = "Invalid email or password. Please check your credentials.";
            }
            setGeneralError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header-group">
                    <h1 className="login-brand-title">EduMate</h1>
                    <p className="login-subtitle">Sign in to your account</p>
                </div>

                {(generalError || sessionError) && (
                    <div className="login-error-banner">
                        <AlertCircle size={16} />
                        <span>{generalError || sessionError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form" noValidate>
                    <div className="login-input-group">
                        <label className="login-label">Email Address</label>
                        <input
                            type="email"
                            className={`login-input ${fieldErrors.email ? "input-error" : ""}`}
                            placeholder="name@university.edu"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldErrors.email) {
                                    setFieldErrors((prev) => ({ ...prev, email: "" }));
                                }
                            }}
                            disabled={loading}
                            autoComplete="email"
                        />
                        {fieldErrors.email && (
                            <span className="field-error-text">{fieldErrors.email}</span>
                        )}
                    </div>

                    <div className="login-input-group">
                        <div className="password-label-row">
                            <label className="login-label">Password</label>
                            <Link to="/forgot-password" className="forgot-password-link">
                                Forgot Password?
                            </Link>
                        </div>
                        <div className="login-password-box">
                            <input
                                type={showPassword ? "text" : "password"}
                                className={`login-input ${fieldErrors.password ? "input-error" : ""}`}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (fieldErrors.password) {
                                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                                    }
                                }}
                                disabled={loading}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </button>
                        </div>
                        {fieldErrors.password && (
                            <span className="field-error-text">{fieldErrors.password}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="login-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spin-icon" />
                                Signing in...
                            </>
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        Don't have an account?{" "}
                        <Link to="/register" className="register-link">
                            Create Account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
