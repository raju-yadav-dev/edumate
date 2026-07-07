const User = require("../models/User");
const { ACCOUNT_STATUS } = require("../constants/accountStatus");
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
    if (actor._id.toString() === userId) {
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
    user.updatedBy = actor._id;
    await user.save();

    return sanitizeUser(user);
};

module.exports = {
    listUsers,
    deleteUser
};
