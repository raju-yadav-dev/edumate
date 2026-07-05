import "./Login.css";

import { Link } from "react-router-dom";

function Login() {

    return (

        <div className="login-page">

            <div className="login-card">

                <h1>EduMate</h1>

                <p>Sign in to continue</p>

                <form>

                    <input
                        type="email"
                        placeholder="Email Address"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                    />

                    <button>
                        Login
                    </button>

                </form>

                <div className="login-links">

                    <Link to="/forgot-password">
                        Forgot Password?
                    </Link>

                    <p>
                        Don't have an account?

                        <Link to="/register">
                            Register
                        </Link>

                    </p>

                </div>

            </div>

        </div>

    );

}

export default Login;