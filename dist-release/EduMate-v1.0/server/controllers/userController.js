const User = require("../models/User");
const { sendSuccess, sendError } = require("../utils/response");
const { sanitizeUser } = require("../services/authService");
const userService = require("../services/userService");
const asyncHandler = require("../utils/asyncHandler");

const updateProfileAvatar = async (req, res) => {

    try {

        const { userId } = req.params;

        if (!req.file) {
            return sendError(res, 400, "Please select an image to upload.");
        }

        const canUpdateProfile = req.user?._id?.toString() === userId ||
            ["admin", "super_admin"].includes(req.user?.role);

        if (!canUpdateProfile) {
            return sendError(res, 403, "You can only update your own profile photo.");
        }

        const user = await User.findById(userId);

        if (!user) {
            return sendError(res, 404, "User not found.");
        }

        const base64Image = req.file.buffer.toString("base64");
        user.avatar = `data:${req.file.mimetype};base64,${base64Image}`;
        await user.save();

        return sendSuccess(
            res,
            200,
            "Profile photo updated successfully.",
            sanitizeUser(user)
        );

    } catch (error) {

        console.error(error);

        return sendError(res, 500, "Internal Server Error");

    }

};

const listUsers = asyncHandler(async (req, res) => {
    const result = await userService.listUsers({
        query: req.query
    });

    return sendSuccess(
        res,
        200,
        "Users retrieved successfully.",
        result.users,
        null,
        result.pagination
    );
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await userService.deleteUser({
        userId: req.params.userId,
        actor: req.user
    });

    return sendSuccess(res, 200, "User deleted successfully.", user);
});

module.exports = {
    updateProfileAvatar,
    listUsers,
    deleteUser
};
