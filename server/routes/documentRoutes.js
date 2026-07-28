const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const documentUpload = require("../middleware/documentUploadMiddleware");
const {
    uploadDocument,
    listDocuments,
    deleteDocument,
    replaceDocument,
    renameDocument,
    moveDocument,
    reindexDocument,
    rebuildAllEmbeddings
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
router.put(
    "/:documentId",
    authorizeRoles("admin", "super_admin"),
    documentUpload.single("document"),
    replaceDocument
);
router.put(
    "/:documentId/rename",
    authorizeRoles("admin", "super_admin"),
    renameDocument
);
router.put(
    "/:documentId/move",
    authorizeRoles("admin", "super_admin"),
    moveDocument
);
router.delete(
    "/:documentId",
    authorizeRoles("admin", "super_admin"),
    deleteDocument
);
router.post(
    "/rebuild",
    authorizeRoles("admin", "super_admin"),
    rebuildAllEmbeddings
);
router.post(
    "/:documentId/reindex",
    authorizeRoles("admin", "super_admin"),
    reindexDocument
);
router.post(
    "/:documentId/embeddings/rebuild",
    authorizeRoles("admin", "super_admin"),
    reindexDocument
);

module.exports = router;
