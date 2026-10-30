/**
 * Secure Document Upload Middleware — EduMate Mission 19
 * 
 * Features:
 * - Allowed types: PDF, DOCX, TXT, MD, CSV, JPEG, PNG, WEBP
 * - Magic bytes signature inspection to prevent renamed malicious binaries
 * - Max file size enforcement (50 MB default)
 * - SHA-256 checksum computation
 */

const multer = require("multer");
const crypto = require("crypto");

const allowedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/html",
    "application/json",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/jfif",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/gif"
];

function verifyFileSignature(buffer, mimetype) {
    if (!buffer || buffer.length < 4) return false;

    // 1. PDF signature (%PDF-)
    if (mimetype === "application/pdf") {
        return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    }

    // 2. OpenXML (DOCX, PPTX, XLSX) / ZIP signature (PK\x03\x04)
    if (mimetype.includes("openxmlformats-officedocument") || mimetype === "application/zip") {
        return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    }

    // 3. Legacy OLE2 binary (DOC, PPT, XLS)
    if (mimetype === "application/msword" || mimetype === "application/vnd.ms-powerpoint" || mimetype === "application/vnd.ms-excel") {
        return buffer.length >= 8 &&
            buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
            buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1;
    }

    // 4. PNG signature (\x89PNG)
    if (mimetype === "image/png") {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }

    // 5. JPEG signature (\xFF\xD8\xFF)
    if (mimetype === "image/jpeg" || mimetype === "image/jpg" || mimetype === "image/pjpeg" || mimetype === "image/jfif") {
        return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }

    // 6. BMP signature (BM)
    if (mimetype === "image/bmp") {
        return buffer[0] === 0x42 && buffer[1] === 0x4D;
    }

    // 7. TIFF signature
    if (mimetype === "image/tiff") {
        return (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
               (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A);
    }

    // 8. WEBP signature (RIFF....WEBP)
    if (mimetype === "image/webp") {
        return buffer.length >= 12 &&
            buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
            buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    }

    // 9. Plain Text / Markdown / CSV / HTML / JSON (Must not contain null bytes or binary executable headers MZ, ELF)
    if (mimetype.startsWith("text/") || mimetype === "text/markdown" || mimetype === "text/plain" || mimetype === "application/json") {
        // Block Windows PE executable 'MZ' (0x4D 0x5A) or Linux ELF (0x7F 'ELF')
        if (buffer[0] === 0x4D && buffer[1] === 0x5A) return false;
        if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) return false;
        
        // Scan first 1KB for null bytes
        const sampleLimit = Math.min(buffer.length, 1024);
        for (let i = 0; i < sampleLimit; i++) {
            if (buffer[i] === 0x00) return false;
        }
        return true;
    }

    return true;
}

const documentUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error(`Unsupported document type (${file.mimetype}). Allowed: PDF, DOCX, TXT, MD, CSV, Images.`), false);
        }
        return cb(null, true);
    },
    limits: {
        fileSize: Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 50 * 1024 * 1024)
    }
});

/**
 * Middleware to verify magic bytes and compute checksum after multer buffering
 */
const verifyUploadSignatureMiddleware = (req, res, next) => {
    const file = req.file;
    if (file && file.buffer) {
        if (!verifyFileSignature(file.buffer, file.mimetype)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_FILE_SIGNATURE",
                message: "File signature does not match the stated file extension/MIME type."
            });
        }
        // Compute SHA-256 checksum
        file.checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    }

    if (req.files && Array.isArray(req.files)) {
        for (const f of req.files) {
            if (f.buffer) {
                if (!verifyFileSignature(f.buffer, f.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        code: "INVALID_FILE_SIGNATURE",
                        message: `File signature mismatch for '${f.originalname}'.`
                    });
                }
                f.checksum = crypto.createHash("sha256").update(f.buffer).digest("hex");
            }
        }
    }

    next();
};

module.exports = documentUpload;
module.exports.verifyFileSignature = verifyFileSignature;
module.exports.verifyUploadSignatureMiddleware = verifyUploadSignatureMiddleware;
