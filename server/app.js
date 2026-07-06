const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

// ==============================
// Middlewares
// ==============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// ==============================
// Test Route
// ==============================

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        message: "EduMate Backend Running 🚀"

    });

});

module.exports = app;