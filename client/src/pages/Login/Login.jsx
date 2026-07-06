import "./Login.css";

import { Link } from "react-router-dom";

import { useState } from "react";

import { FaEye, FaEyeSlash } from "react-icons/fa";


function Login() {


    const [showPassword, setShowPassword] = useState(false);


    return (

        <div className="login-page">


            <div className="login-card">


                <h1>EduMate</h1>


                <p>
                    Sign in to continue
                </p>


                <form>


                    <input

                        type="email"

                        placeholder="Email Address"

                    />



                    <div className="login-password-box">


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