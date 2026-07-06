const User = require("../models/User");

const updateProfileAvatar = async (req, res) => {

    try {

        const { userId } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select an image to upload."
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const base64Image = req.file.buffer.toString("base64");
        user.avatar = `data:${req.file.mimetype};base64,${base64Image}`;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile photo updated successfully.",
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });

    }

};

module.exports = {
    updateProfileAvatar
};