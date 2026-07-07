const multer = require("multer");

const allowedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/webp"
];

const documentUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Unsupported document type."), false);
        }

        return cb(null, true);
    },
    limits: {
        fileSize: Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 25 * 1024 * 1024)
    }
});

module.exports = documentUpload;
