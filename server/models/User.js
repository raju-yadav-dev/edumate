const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
        },

        role: {
            type: String,
            enum: ["student", "teacher", "admin"],
            default: "student",
        },

        institution: {
            type: String,
            default: "",
        },

        avatar: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// ==============================
// Hash Password Before Saving
// ==============================

userSchema.pre("save", async function () {

    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);

});

// ==============================
// Compare Password
// ==============================

userSchema.methods.comparePassword = async function (enteredPassword) {

    return await bcrypt.compare(
        enteredPassword,
        this.password
    );

};

// ==============================
// Export Model
// ==============================

module.exports = mongoose.model("User", userSchema);