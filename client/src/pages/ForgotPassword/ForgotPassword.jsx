import "./ForgotPassword.css";

import { Link, useNavigate } from "react-router-dom";

import { useState } from "react";

import { FaEye, FaEyeSlash } from "react-icons/fa";

import { forgotPassword } from "../../services/authService";

function ForgotPassword() {

    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setMessage("");
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await forgotPassword({ email, newPassword });
            setMessage(response.message || "Password updated successfully.");
            navigate("/login");
        } catch (authError) {
            setError(authError.message || "Unable to reset password.");
        } finally {
            setLoading(false);
        }
    };

    return (

        <div className="forgot-page">

            <div className="forgot-card">

                <h1>Reset Password</h1>

                <p>
                    Enter your email to reset your password
                </p>

                <form onSubmit={handleSubmit}>

                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />

                    <div className="forgot-password-box">
                        <input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                        />
                        <button type="button" className="forgot-password-toggle" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <div className="forgot-password-box">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                        <button type="button" className="forgot-password-toggle" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <button type="submit" disabled={loading}>
                        {loading ? "Updating..." : "Reset Password"}
                    </button>

                    {message ? <p className="forgot-message success">{message}</p> : null}
                    {error ? <p className="forgot-message error">{error}</p> : null}

                </form>

                <div className="forgot-links">

                    <Link to="/login">
                        Back to Login
                    </Link>

                </div>

            </div>

        </div>

    );

}

export default ForgotPassword;
