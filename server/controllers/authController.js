const User = require("../models/User");

// ==============================
// Register User
// ==============================

const registerUser = async (req, res) => {

    try {

        const {
            fullName,
            email,
            password,
            role,
            institution
        } = req.body;

        // Check required fields

        if (!fullName || !email || !password) {

            return res.status(400).json({

                success: false,

                message: "Please fill all required fields."

            });

        }

        // Check existing user

        const existingUser = await User.findOne({ email });

        if (existingUser) {

            return res.status(400).json({

                success: false,

                message: "User already exists."

            });

        }

        // Create User

        const user = await User.create({

            fullName,

            email,

            password,

            role,

            institution

        });

        res.status(201).json({

            success: true,

            message: "Registration Successful",

            data: {

                id: user._id,

                fullName: user.fullName,

                email: user.email,

                role: user.role

            }

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal Server Error"

        });

    }

};

module.exports = {

    registerUser,
    loginUser

};


// ==============================
// Login User
// ==============================

const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;

        // Check required fields

        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message: "Email and Password are required."

            });

        }

        // Find user

        const user = await User.findOne({ email });

        if (!user) {

            return res.status(401).json({

                success: false,

                message: "Invalid Email or Password."

            });

        }

        // Compare password

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {

            return res.status(401).json({

                success: false,

                message: "Invalid Email or Password."

            });

        }

        res.status(200).json({

            success: true,

            message: "Login Successful"

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal Server Error"

        });

    }

};