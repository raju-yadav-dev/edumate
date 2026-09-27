const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../constants/roles");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

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
            minlength: 8,
        },

        passwordHistory: {
            type: [String],
            default: [],
            select: false, // Don't return password history by default
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

        passwordResetToken: {
            type: String,
            default: null,
            select: false,
        },

        passwordResetExpires: {
            type: Date,
            default: null,
            select: false,
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
// Password Strength Validator
// ==============================
userSchema.statics.validatePasswordStrength = function (password) {
    if (!password || typeof password !== "string") {
        return { valid: false, message: "Password must be a valid string." };
    }
    if (password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one lowercase letter." };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: "Password must contain at least one number." };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { valid: false, message: "Password must contain at least one special character." };
    }
    return { valid: true };
};

// ==============================
// Check Password History
// ==============================
userSchema.methods.checkPasswordHistory = async function (newPassword) {
    if (!this.passwordHistory || this.passwordHistory.length === 0) {
        return false;
    }
    for (const oldHash of this.passwordHistory) {
        const isMatch = await bcrypt.compare(newPassword, oldHash);
        if (isMatch) return true;
    }
    return false;
};

// ==============================
// Hash Password Before Saving
// ==============================
userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    // Save previous password to history (keep last 5)
    if (this._previousPassword) {
        this.passwordHistory = this.passwordHistory || [];
        this.passwordHistory.unshift(this._previousPassword);
        if (this.passwordHistory.length > 5) {
            this.passwordHistory = this.passwordHistory.slice(0, 5);
        }
    }

    this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
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
