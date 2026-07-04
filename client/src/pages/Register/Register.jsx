import "./Register.css";

function Register() {

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

                    <input
                        type="password"
                        placeholder="Password"
                    />

                    <input
                        type="password"
                        placeholder="Confirm Password"
                    />

                    <select>

                        <option>Student</option>

                        <option>Teacher</option>

                    </select>

                    <button>

                        Register

                    </button>

                </form>

            </div>

        </div>

    );

}

export default Register;