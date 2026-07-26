const crypto = require("crypto");
const path = require("path");
const Document = require("../models/Document");
const supabase = require("../config/supabase");
const indexingService = require("../ai/services/indexingService");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET;

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
    "forms",
    "previous_years",
    "documents",
    "archives",
    "policies",
    "reports",
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

const getSignedUrlForDoc = async (storagePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 3600);
        return data?.signedUrl || "";
    } catch (e) {
        console.error("Error creating signed URL:", e);
        return "";
    }
};

const uploadToSupabase = async (file, category) => {
    const extension = getSafeExtension(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const storagePath = `${category}/${uniqueName}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        throw error;
    }

    return {
        storedName: uniqueName,
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

    const category = sanitizeCategory(body.category);
    const savedFile = await uploadToSupabase(file, category);

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

    // Delegate background indexing trigger to AI indexingService
    indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
        console.error(`Failed to trigger background indexing for ${document._id}:`, err);
    });

    const signedUrl = await getSignedUrlForDoc(savedFile.storagePath);
    return {
        ...document.toObject(),
        signedUrl
    };
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
            .limit(limit),
        Document.countDocuments(filter)
    ]);

    const paths = documents.map(d => d.storagePath).filter(Boolean);
    let signedUrlsMap = {};
    if (paths.length > 0) {
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrls(paths, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 3600);
            if (!error && data) {
                data.forEach(item => {
                    if (item.signedUrl) {
                        signedUrlsMap[item.path] = item.signedUrl;
                    }
                });
            }
        } catch (e) {
            console.error("Error creating signed URLs in batch:", e);
        }
    }

    const documentsWithUrls = documents.map(doc => {
        const docObj = doc.toObject();
        docObj.signedUrl = signedUrlsMap[doc.storagePath] || "";
        return docObj;
    });

    return {
        documents: documentsWithUrls,
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

    try {
        await supabase.storage.from(BUCKET).remove([document.storagePath]);
    } catch (storageErr) {
        console.error(`Failed to delete file ${document.storagePath} from Supabase:`, storageErr);
    }

    document.status = "deleted";
    document.updatedBy = user._id;
    await document.save();

    // Clean up vector index chunks from ChromaDB via AI service
    await indexingService.deleteDocumentIndex(documentId);

    return document;
};

const replaceDocument = async ({ documentId, file, body, user }) => {
    const document = await Document.findOne({
        _id: documentId,
        status: { $ne: "deleted" }
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    let storedName = document.storedName;
    let storagePath = document.storagePath;
    let fileSize = document.fileSize;
    let checksum = document.checksum;
    let mimeType = document.mimeType;
    let originalName = document.originalName;

    const category = sanitizeCategory(body.category || document.category);

    if (file) {
        const uploadResult = await uploadToSupabase(file, category);
        storedName = uploadResult.storedName;
        storagePath = uploadResult.storagePath;
        fileSize = file.size;
        checksum = getChecksum(file.buffer);
        mimeType = file.mimetype;
        originalName = file.originalname;

        try {
            await supabase.storage.from(BUCKET).remove([document.storagePath]);
        } catch (storageErr) {
            console.error(`Failed to delete old file ${document.storagePath} from Supabase:`, storageErr);
        }
    } else if (body.category && body.category !== document.category) {
        const uniqueName = document.storedName;
        const newStoragePath = `${category}/${uniqueName}`;

        const { error } = await supabase.storage
            .from(BUCKET)
            .move(document.storagePath, newStoragePath);

        if (error) {
            console.error(`Failed to move file from ${document.storagePath} to ${newStoragePath} in Supabase:`, error);
        } else {
            storagePath = newStoragePath;
        }
    }

    const nextVersionNumber = (document.versions?.length || 0) + 1;
    const newVersion = {
        version: nextVersionNumber,
        storedName,
        storagePath,
        fileSize,
        checksum,
        uploadedBy: user._id,
        uploadedAt: new Date()
    };

    document.originalName = originalName;
    document.storedName = storedName;
    document.category = category;
    document.institution = body.institution?.trim() || document.institution;
    document.department = body.department?.trim() || document.department;
    document.mimeType = mimeType;
    document.fileSize = fileSize;
    document.checksum = checksum;
    document.storagePath = storagePath;
    document.updatedBy = user._id;

    if (file) {
        document.versions.push(newVersion);
    }

    if (body.notes) {
        document.metadata = {
            ...(document.metadata || {}),
            notes: body.notes
        };
    }

    await document.save();

    // Rebuild index in ChromaDB
    if (file) {
        indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
            console.error(`Failed to trigger re-indexing on document replacement for ${document._id}:`, err);
        });
    } else {
        // Metadata changed. Force a full index rebuild to align metadatas in ChromaDB.
        await indexingService.deleteDocumentIndex(document._id);
        indexingService.indexDocumentBackground(document._id).catch(() => {});
    }

    const signedUrl = await getSignedUrlForDoc(storagePath);
    return {
        ...document.toObject(),
        signedUrl
    };
};

const renameDocument = async ({ documentId, originalName, user }) => {
    if (!originalName || originalName.trim() === "") {
        const error = new Error("Document name is required.");
        error.statusCode = 400;
        throw error;
    }

    const document = await Document.findOne({
        _id: documentId,
        status: { $ne: "deleted" }
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    document.originalName = originalName.trim();
    document.updatedBy = user._id;
    await document.save();

    // Rebuild index in ChromaDB to update originalName metadata
    await indexingService.deleteDocumentIndex(document._id);
    indexingService.indexDocumentBackground(document._id).catch(() => {});

    const signedUrl = await getSignedUrlForDoc(document.storagePath);
    return {
        ...document.toObject(),
        signedUrl
    };
};

const moveDocument = async ({ documentId, category, user }) => {
    const targetCategory = sanitizeCategory(category);

    const document = await Document.findOne({
        _id: documentId,
        status: { $ne: "deleted" }
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    if (document.category === targetCategory) {
        const signedUrl = await getSignedUrlForDoc(document.storagePath);
        return {
            ...document.toObject(),
            signedUrl
        };
    }

    const oldStoragePath = document.storagePath;
    const newStoragePath = `${targetCategory}/${document.storedName}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .move(oldStoragePath, newStoragePath);

    if (error && error.message !== "The resource was not found") {
        const err = new Error(`Failed to move file in storage: ${error.message}`);
        err.statusCode = 500;
        throw err;
    }

    document.category = targetCategory;
    document.storagePath = newStoragePath;
    document.updatedBy = user._id;
    await document.save();

    // Rebuild index in ChromaDB to update category metadata
    await indexingService.deleteDocumentIndex(document._id);
    indexingService.indexDocumentBackground(document._id).catch(() => {});

    const signedUrl = await getSignedUrlForDoc(newStoragePath);
    return {
        ...document.toObject(),
        signedUrl
    };
};

const reindexDocument = async ({ documentId }) => {
    return indexingService.reindexDocument({ documentId });
};

const rebuildAllEmbeddings = async () => {
    return indexingService.rebuildAllEmbeddings();
};

const indexDocumentBackground = async (documentId, fileBuffer = null) => {
    return indexingService.indexDocumentBackground(documentId, fileBuffer);
};

module.exports = {
    uploadDocument,
    listDocuments,
    archiveDocument,
    replaceDocument,
    renameDocument,
    moveDocument,
    reindexDocument,
    rebuildAllEmbeddings,
    indexDocumentBackground,
    DOCUMENT_CATEGORIES
};
