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

        const normalizedEmail = email?.toLowerCase().trim();

        if (!fullName || !normalizedEmail || !password) {

            return res.status(400).json({

                success: false,

                message: "Please fill all required fields."

            });

        }

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {

            return res.status(400).json({

                success: false,

                message: "User already exists."

            });

        }

        const user = await User.create({

            fullName,

            email: normalizedEmail,

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

                role: user.role,

                avatar: user.avatar

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

// ==============================
// Login User
// ==============================

const loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;
        const normalizedEmail = email?.toLowerCase().trim();

        if (!normalizedEmail || !password) {

            return res.status(400).json({

                success: false,

                message: "Email and Password are required."

            });

        }

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {

            return res.status(401).json({

                success: false,

                message: "Invalid Email or Password."

            });

        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {

            return res.status(401).json({

                success: false,

                message: "Invalid Email or Password."

            });

        }

        res.status(200).json({

            success: true,

            message: "Login Successful",

            data: {

                id: user._id,

                fullName: user.fullName,

                email: user.email,

                role: user.role,

                avatar: user.avatar

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

// ==============================
// Reset Password
// ==============================

const forgotPassword = async (req, res) => {

    try {

        const {
            email,
            newPassword
        } = req.body;

        const normalizedEmail = email?.toLowerCase().trim();

        if (!normalizedEmail || !newPassword) {

            return res.status(400).json({

                success: false,

                message: "Email and new password are required."

            });

        }

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {

            return res.status(404).json({

                success: false,

                message: "No account found for this email address."

            });

        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({

            success: true,

            message: "Password updated successfully."

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
    loginUser,
    forgotPassword

};