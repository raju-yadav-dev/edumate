const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const { updateProfileAvatar } = require("../controllers/userController");

router.put("/:userId/avatar", upload.single("avatar"), updateProfileAvatar);

module.exports = router;