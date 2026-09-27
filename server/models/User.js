const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../constants/roles");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

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

        failedLoginAttempts: {
            type: Number,
            default: 0,
        },

        accountLockedUntil: {
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
// Compare Password Method
// ==============================

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// ==============================
// Account Lock Methods
// ==============================

userSchema.methods.isLocked = function () {
    return Boolean(this.accountLockedUntil && this.accountLockedUntil > Date.now());
};

userSchema.methods.incrementFailedAttempts = async function () {
    this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
    if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        this.accountLockedUntil = new Date(Date.now() + LOCK_TIME_MS);
    }
    if (mongoose.connection?.readyState === 1) {
        return await this.save();
    }
    return this;
};

userSchema.methods.resetFailedAttempts = async function () {
    if (this.failedLoginAttempts > 0 || this.accountLockedUntil) {
        this.failedLoginAttempts = 0;
        this.accountLockedUntil = null;
        if (mongoose.connection?.readyState === 1) {
            return await this.save();
        }
    }
    return this;
};

module.exports = mongoose.model("User", userSchema);
