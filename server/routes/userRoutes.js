const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { deleteUser, listUsers, updateProfileAvatar, updateUser, createUser } = require("../controllers/userController");

router.get(["/", ""], authenticate, authorizeRoles("admin", "super_admin"), listUsers);
router.post(["/", ""], authenticate, authorizeRoles("admin", "super_admin"), createUser);
router.put("/:userId/avatar", authenticate, upload.single("avatar"), updateProfileAvatar);
router.patch("/:userId", authenticate, authorizeRoles("admin", "super_admin"), updateUser);
router.delete("/:userId", authenticate, authorizeRoles("admin", "super_admin"), deleteUser);

module.exports = router;
