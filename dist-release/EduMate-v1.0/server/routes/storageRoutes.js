const express = require("express");

const router = express.Router();

const {

    getStorageOverview

} = require("../controllers/storageController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(

    "/",

    authMiddleware,

    roleMiddleware(["admin"]),

    getStorageOverview

);

module.exports = router;