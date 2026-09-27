const express = require("express");

const router = express.Router();

const upload = require("../middleware/documentUploadMiddleware");

const {

    uploadDocument

} = require("../controllers/uploadController");

// auth middleware
const authMiddleware = require("../middleware/authMiddleware");

// admin middleware
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(

    "/",

    authMiddleware,

    roleMiddleware(["admin"]),

    upload.single("document"),

    uploadDocument

);

module.exports = router;