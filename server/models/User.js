const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../constants/roles");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");

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
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.STUDENT,
            index: true,
        },

        status: {
            type: String,
            enum: Object.values(ACCOUNT_STATUS),
            default: ACCOUNT_STATUS.ACTIVE,
            index: true,
        },

        institution: {
            type: String,
            default: "",
        },

        avatar: {
            type: String,
            default: "",
        },

        department: {
            type: String,
            default: "",
            trim: true,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },

        passwordChangedAt: {
            type: Date,
            default: null,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ institution: 1, role: 1, status: 1 });

// ==============================
// Hash Password Before Saving
// ==============================

userSchema.pre("save", async function () {

    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
    this.passwordChangedAt = new Date();

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
