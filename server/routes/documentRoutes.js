const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const documentUpload = require("../middleware/documentUploadMiddleware");
const {
    uploadDocument,
    listDocuments,
    deleteDocument
} = require("../controllers/documentController");

const router = express.Router();

router.use(authenticate);

router.get("/", listDocuments);
router.post(
    "/",
    authorizeRoles("teacher", "faculty", "admin", "super_admin"),
    documentUpload.single("document"),
    uploadDocument
);
router.delete(
    "/:documentId",
    authorizeRoles("admin", "super_admin"),
    deleteDocument
);

module.exports = router;
