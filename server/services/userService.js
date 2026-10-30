const User = require("../models/User");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");
const { USER_ROLES } = require("../constants/roles");
const { sanitizeUser } = require("./authService");

const listUsers = async ({ query }) => {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {
        status: { $ne: ACCOUNT_STATUS.DELETED }
    };

    if (query.role) {
        filter.role = query.role;
    }

    if (query.status) {
        filter.status = query.status;
    }

    if (query.search) {
        const search = String(query.search).trim();
        filter.$or = [
            { fullName: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
            { institution: new RegExp(search, "i") }
        ];
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-password"),
        User.countDocuments(filter)
    ]);

    return {
        users: users.map(sanitizeUser),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

const deleteUser = async ({ userId, actor }) => {
    const actorId = actor?._id ? actor._id.toString() : String(actor?.id || "");
    if (actorId && actorId === userId) {
        const error = new Error("You cannot delete your own admin account.");
        error.statusCode = 400;
        throw error;
    }

    const user = await User.findById(userId);

    if (!user || user.status === ACCOUNT_STATUS.DELETED) {
        const error = new Error("User not found.");
        error.statusCode = 404;
        throw error;
    }

    user.status = ACCOUNT_STATUS.DELETED;
    user.updatedBy = actor?._id || actor?.id || null;
    await user.save();

    return sanitizeUser(user);
};

const updateUser = async ({ userId, data, actor }) => {
    const actorId = actor?._id ? actor._id.toString() : String(actor?.id || "");
    const user = await User.findById(userId);
    if (!user || user.status === ACCOUNT_STATUS.DELETED) {
        const error = new Error("User not found.");
        error.statusCode = 404;
        throw error;
    }

    if (data.role && Object.values(USER_ROLES).includes(data.role)) {
        if (actorId && actorId === userId && data.role !== user.role && user.role === USER_ROLES.SUPER_ADMIN) {
            const error = new Error("You cannot change your own super_admin role.");
            error.statusCode = 400;
            throw error;
        }
        user.role = data.role;
    }

    if (data.status && Object.values(ACCOUNT_STATUS).includes(data.status)) {
        if (actorId && actorId === userId && data.status !== ACCOUNT_STATUS.ACTIVE) {
            const error = new Error("You cannot deactivate or suspend your own account.");
            error.statusCode = 400;
            throw error;
        }
        user.status = data.status;
    }

    if (data.fullName && typeof data.fullName === "string") {
        user.fullName = data.fullName.trim();
    }
    if (data.department !== undefined && typeof data.department === "string") {
        user.department = data.department.trim();
    }
    if (data.institution !== undefined && typeof data.institution === "string") {
        user.institution = data.institution.trim();
    }

    user.updatedBy = actor._id;
    await user.save();
    return sanitizeUser(user);
};

const createUser = async ({ data, actor }) => {
    const fullName = String(data.fullName || "").trim();
    const email = String(data.email || "").toLowerCase().trim();
    const password = String(data.password || "").trim();
    const role = data.role && Object.values(USER_ROLES).includes(data.role) ? data.role : USER_ROLES.STUDENT;
    const department = String(data.department || "").trim();
    const institution = String(data.institution || "").trim();

    if (!fullName || !email || !password) {
        const error = new Error("Full name, email, and password are required.");
        error.statusCode = 400;
        throw error;
    }

    const strength = User.validatePasswordStrength(password);
    if (!strength.valid) {
        const error = new Error(strength.message || "Password is not strong enough.");
        error.statusCode = 400;
        throw error;
    }

    const existing = await User.findOne({ email });
    if (existing) {
        const error = new Error("User with this email already exists.");
        error.statusCode = 409;
        throw error;
    }

    const user = await User.create({
        fullName,
        email,
        password,
        role,
        department,
        institution,
        status: ACCOUNT_STATUS.ACTIVE,
        createdBy: actor?._id || actor?.id || null
    });

    return sanitizeUser(user);
};

module.exports = {
    listUsers,
    deleteUser,
    updateUser,
    createUser
};
