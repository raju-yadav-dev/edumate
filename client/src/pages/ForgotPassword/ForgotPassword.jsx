import "./ForgotPassword.css";

import { Link, useNavigate } from "react-router-dom";

import { useState } from "react";

import { forgotPassword } from "../../services/authService";

function ForgotPassword() {

    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
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

                    <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                    />

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