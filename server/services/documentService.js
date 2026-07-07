const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const Document = require("../models/Document");

const DOCUMENT_CATEGORIES = Object.freeze([
    "admissions",
    "fees",
    "hostel",
    "departments",
    "placements",
    "scholarships",
    "rules",
    "faculty",
    "library",
    "academic_calendar",
    "transport",
    "sports",
    "examination",
    "events",
    "notices",
    "gallery",
    "contact",
    "others"
]);

const sanitizeCategory = (category) => {
    const normalizedCategory = String(category || "others").toLowerCase().trim().replace(/\s+/g, "_");

    return DOCUMENT_CATEGORIES.includes(normalizedCategory) ? normalizedCategory : "others";
};

const getChecksum = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const getSafeExtension = (originalName) => {
    const extension = path.extname(originalName || "").toLowerCase();

    return extension.replace(/[^a-z0-9.]/g, "") || ".bin";
};

const getUploadDirectory = () => path.resolve(__dirname, "..", "uploads", "documents");

const saveFile = async (file) => {
    const uploadDirectory = getUploadDirectory();
    await fs.mkdir(uploadDirectory, { recursive: true });

    const storedName = `${crypto.randomUUID()}${getSafeExtension(file.originalname)}`;
    const storagePath = path.join(uploadDirectory, storedName);

    await fs.writeFile(storagePath, file.buffer);

    return {
        storedName,
        storagePath
    };
};

const uploadDocument = async ({ file, body, user }) => {
    if (!file) {
        const error = new Error("Document file is required.");
        error.statusCode = 400;
        throw error;
    }

    const checksum = getChecksum(file.buffer);
    const duplicate = await Document.findOne({
        checksum,
        institution: body.institution || user.institution || "",
        status: { $ne: "deleted" }
    });

    if (duplicate) {
        const error = new Error("This document already exists in the knowledge base.");
        error.statusCode = 409;
        throw error;
    }

    const savedFile = await saveFile(file);
    const category = sanitizeCategory(body.category);

    const document = await Document.create({
        originalName: file.originalname,
        storedName: savedFile.storedName,
        category,
        institution: body.institution?.trim() || user.institution || "",
        department: body.department?.trim() || user.department || "",
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
        storagePath: savedFile.storagePath,
        metadata: {
            uploadedFrom: "api",
            notes: body.notes || ""
        },
        versions: [
            {
                version: 1,
                storedName: savedFile.storedName,
                storagePath: savedFile.storagePath,
                fileSize: file.size,
                checksum,
                uploadedBy: user._id
            }
        ],
        createdBy: user._id,
        updatedBy: user._id
    });

    return document;
};

const listDocuments = async ({ query, user }) => {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {
        status: { $ne: "deleted" }
    };

    if (query.category) {
        filter.category = sanitizeCategory(query.category);
    }

    if (query.embeddingStatus) {
        filter.embeddingStatus = query.embeddingStatus;
    }

    if (query.search) {
        filter.$text = { $search: query.search };
    }

    if (query.institution || user.institution) {
        filter.institution = query.institution || user.institution;
    }

    const [documents, total] = await Promise.all([
        Document.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-storagePath -versions.storagePath"),
        Document.countDocuments(filter)
    ]);

    return {
        documents,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

const archiveDocument = async ({ documentId, user }) => {
    const document = await Document.findOne({
        _id: documentId,
        status: { $ne: "deleted" }
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    document.status = "deleted";
    document.updatedBy = user._id;
    await document.save();

    return document;
};

module.exports = {
    uploadDocument,
    listDocuments,
    archiveDocument,
    DOCUMENT_CATEGORIES
};
