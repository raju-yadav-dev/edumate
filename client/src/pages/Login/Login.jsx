import "./Login.css";

import { Link, useNavigate } from "react-router-dom";

import { useState } from "react";

import { FaEye, FaEyeSlash } from "react-icons/fa";

import { loginUser } from "../../services/authService";
import useAuth from "../../hooks/useAuth";


function Login() {


    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setMessage("");
        setError("");
        setLoading(true);

        try {
            const response = await loginUser({ email, password });
            if (response.data) {
                login(response.data);
            }
            setMessage(response.message || "Login successful.");
            navigate("/");
        } catch (authError) {
            setError(authError.message || "Unable to sign in.");
        } finally {
            setLoading(false);
        }
    };


    return (

        <div className="login-page">


            <div className="login-card">


                <h1>EduMate</h1>


                <p>
                    Sign in to continue
                </p>


                <form onSubmit={handleSubmit}>


                    <input

                        type="email"

                        placeholder="Email Address"

                        value={email}

                        onChange={(event) => setEmail(event.target.value)}

                    />



                    <div className="login-password-box">


                        <input

                            type={showPassword ? "text" : "password"}

                            placeholder="Password"

                            value={password}

                            onChange={(event) => setPassword(event.target.value)}

                        />


                        <span
                            onClick={() =>
                                setShowPassword(!showPassword)
                            }
                        >

                            {
                                showPassword
                                ? <FaEyeSlash />
                                : <FaEye />
                            }


                        </span>


                    </div>



                    <button type="submit" disabled={loading}>

                        {loading ? "Signing in..." : "Login"}

                    </button>

                    {message ? <p className="login-message success">{message}</p> : null}
                    {error ? <p className="login-message error">{error}</p> : null}


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