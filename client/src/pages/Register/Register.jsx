import "./Register.css";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Register() {

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    return (

        <div className="register-page">

            <div className="register-card">

                <h1>Create Account</h1>

                <p>Join EduMate</p>


                <form>


                    <input
                        type="text"
                        placeholder="Full Name"
                    />


                    <input
                        type="email"
                        placeholder="Email Address"
                    />


                    <div className="password-box">

                        <input

                            type={showPassword ? "text" : "password"}

                            placeholder="Password"

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

                         <select>

                            <option>Student</option>

                            <option>Teacher</option>

                        </select>

                    </div>

                    <button>

                        Register

                    </button>


                </form>


            </div>

        </div>

    );

}


export default Register;