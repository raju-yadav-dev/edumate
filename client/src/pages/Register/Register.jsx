import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import "./Register.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: "Weak", color: "#ef4444" };
    if (score === 3) return { score, label: "Fair", color: "#f59e0b" };
    if (score === 4) return { score, label: "Good", color: "#3b82f6" };
    return { score, label: "Strong", color: "#10b981" };
};

export default function Register() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState("student");
    const [institution, setInstitution] = useState("");
    const [department, setDepartment] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [generalError, setGeneralError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { signup } = useAuth();
    const passwordStrength = calculatePasswordStrength(password);

    const validateForm = () => {
        const errors = {};
        const trimmedName = fullName.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName) {
            errors.fullName = "Full name is required.";
        }

        if (!trimmedEmail) {
            errors.email = "Email address is required.";
        } else if (!emailPattern.test(trimmedEmail)) {
            errors.email = "Please enter a valid email address.";
        }

        if (!password) {
            errors.password = "Password is required.";
        } else if (password.length < 8) {
            errors.password = "Password must be at least 8 characters long.";
        }

        if (!confirmPassword) {
            errors.confirmPassword = "Please confirm your password.";
        } else if (password !== confirmPassword) {
            errors.confirmPassword = "Passwords do not match.";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setGeneralError("");
        setSuccessMessage("");

        if (!validateForm()) return;

        setLoading(true);

        try {
            await signup({
                fullName: fullName.trim(),
                email: email.trim(),
                password,
                role,
                institution: institution.trim(),
                department: department.trim()
            });

            setSuccessMessage("Account created successfully! Redirecting...");
            setTimeout(() => {
                navigate("/");
            }, 1200);
        } catch (err) {
            let msg = err.message || "Registration failed.";
            if (err.code === "USER_ALREADY_EXISTS") {
                msg = "An account with this email address already exists. Please log in.";
            }
            setGeneralError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-card">
                <div className="register-header-group">
                    <h1 className="register-brand-title">EduMate</h1>
                    <p className="register-subtitle">Create your academic account</p>
                </div>

                {generalError && (
                    <div className="register-error-banner">
                        <AlertCircle size={16} />
                        <span>{generalError}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="register-success-banner">
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="register-form" noValidate>
                    {/* Full Name */}
                    <div className="register-input-group">
                        <label className="register-label">Full Name</label>
                        <input
                            type="text"
                            className={`register-input ${fieldErrors.fullName ? "input-error" : ""}`}
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                if (fieldErrors.fullName) {
                                    setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                                }
                            }}
                            disabled={loading}
                        />
                        {fieldErrors.fullName && (
                            <span className="field-error-text">{fieldErrors.fullName}</span>
                        )}
                    </div>

                    {/* Email */}
                    <div className="register-input-group">
                        <label className="register-label">Email Address</label>
                        <input
                            type="email"
                            className={`register-input ${fieldErrors.email ? "input-error" : ""}`}
                            placeholder="name@university.edu"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldErrors.email) {
                                    setFieldErrors((prev) => ({ ...prev, email: "" }));
                                }
                            }}
                            disabled={loading}
                        />
                        {fieldErrors.email && (
                            <span className="field-error-text">{fieldErrors.email}</span>
                        )}
                    </div>

                    {/* Role & Department */}
                    <div className="register-grid-2">
                        <div className="register-input-group">
                            <label className="register-label">Account Role</label>
                            <select
                                className="register-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={loading}
                            >
                                <option value="student">Student</option>
                                <option value="faculty">Faculty / HOD</option>
                                <option value="teacher">Teacher</option>
                            </select>
                        </div>

                        <div className="register-input-group">
                            <label className="register-label">Department</label>
                            <input
                                type="text"
                                className="register-input"
                                placeholder="e.g. Computer Science"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="register-input-group">
                        <label className="register-label">Password</label>
                        <div className="register-password-box">
                            <input
                                type={showPassword ? "text" : "password"}
                                className={`register-input ${fieldErrors.password ? "input-error" : ""}`}
                                placeholder="Create a strong password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (fieldErrors.password) {
                                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                                    }
                                }}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </button>
                        </div>
                        {password && (
                            <div className="password-strength-container">
                                <div className="strength-meter-bar">
                                    <div
                                        className="strength-meter-fill"
                                        style={{
                                            width: `${(passwordStrength.score / 5) * 100}%`,
                                            backgroundColor: passwordStrength.color
                                        }}
                                    />
                                </div>
                                <span
                                    className="strength-label"
                                    style={{ color: passwordStrength.color }}
                                >
                                    {passwordStrength.label}
                                </span>
                            </div>
                        )}
                        {fieldErrors.password && (
                            <span className="field-error-text">{fieldErrors.password}</span>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="register-input-group">
                        <label className="register-label">Confirm Password</label>
                        <div className="register-password-box">
                            <input
                                type={showConfirm ? "text" : "password"}
                                className={`register-input ${fieldErrors.confirmPassword ? "input-error" : ""}`}
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (fieldErrors.confirmPassword) {
                                        setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                                    }
                                }}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowConfirm(!showConfirm)}
                                tabIndex={-1}
                            >
                                {showConfirm ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </button>
                        </div>
                        {fieldErrors.confirmPassword && (
                            <span className="field-error-text">{fieldErrors.confirmPassword}</span>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="register-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spin-icon" />
                                Creating Account...
                            </>
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>

                <div className="register-footer">
                    <p>
                        Already have an account?{" "}
                        <Link to="/login" className="login-link">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}