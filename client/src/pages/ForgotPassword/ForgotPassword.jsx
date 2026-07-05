import "./ForgotPassword.css";

import { Link } from "react-router-dom";

function ForgotPassword() {

    return (

        <div className="forgot-page">

            <div className="forgot-card">

                <h1>Reset Password</h1>

                <p>
                    Enter your email to reset your password
                </p>

                <form>

                    <input
                        type="email"
                        placeholder="Email Address"
                    />

                    <button>
                        Send Reset Link
                    </button>

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