import "./Register.css";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { registerUser } from "../../services/authService";

function Register() {

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState("student");
    const [institution, setInstitution] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setMessage("");
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const response = await registerUser({
                fullName,
                email,
                password,
                role,
                institution
            });

            setMessage(response.message || "Registration successful.");
            navigate("/login");
        } catch (authError) {
            setError(authError.message || "Unable to create account.");
        } finally {
            setLoading(false);
        }
    };

    return (

        <div className="register-page">

            <div className="register-card">

                <h1>Create Account</h1>

                <p>Join EduMate</p>


                <form onSubmit={handleSubmit}>


                    <input
                        type="text"
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                    />


                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />


                    <div className="password-box">

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


                    <div className="password-box">

                        <input

                            type={showConfirm ? "text" : "password"}

                            placeholder="Confirm Password"

                            value={confirmPassword}

                            onChange={(event) => setConfirmPassword(event.target.value)}

                        />


                        <span
                            onClick={() =>
                                setShowConfirm(!showConfirm)
                            }
                        >

                            {
                                showConfirm 
                                ? <FaEyeSlash /> 
                                : <FaEye />
                            }

                        </span>


                    </div>


                   <div className="custom-select">

                         <select value={role} onChange={(event) => setRole(event.target.value)}>

                            <option value="student">Student</option>

                            <option value="teacher">Teacher</option>

                        </select>

                    </div>

                    <input
                        type="text"
                        placeholder="Institution (optional)"
                        value={institution}
                        onChange={(event) => setInstitution(event.target.value)}
                    />

                    <button type="submit" disabled={loading}>

                        {loading ? "Creating account..." : "Register"}

                    </button>

                    {message ? <p className="register-message success">{message}</p> : null}
                    {error ? <p className="register-message error">{error}</p> : null}


                </form>


            </div>

        </div>

    );

}


export default Register;