const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { deleteUser, listUsers, updateProfileAvatar } = require("../controllers/userController");

router.get("/", authenticate, authorizeRoles("admin", "super_admin"), listUsers);
router.put("/:userId/avatar", authenticate, upload.single("avatar"), updateProfileAvatar);
router.delete("/:userId", authenticate, authorizeRoles("admin", "super_admin"), deleteUser);

module.exports = router;
