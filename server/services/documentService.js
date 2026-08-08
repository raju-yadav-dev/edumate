const crypto = require("crypto");
const path = require("path");
const Document = require("../models/Document");
const supabase = require("../config/supabase");
const indexingService = require("../ai/services/indexingService");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET;

const DOCUMENT_CATEGORIES = Object.freeze([
    "admissions",
    "academics",
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
    if (!category) return "others";
    const normalizedCategory = String(category)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/[-\s]+/g, "_")
        .replace(/_+/g, "_");

    return normalizedCategory || "others";
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
            .createSignedUrl(storagePath, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 315360000);
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
    const extension = getSafeExtension(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const storagePath = `${category}/${uniqueName}`;

    const document = await Document.create({
        originalName: file.originalname,
        storedName: uniqueName,
        category,
        institution: body.institution?.trim() || user.institution || "",
        department: body.department?.trim() || user.department || "",
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
        contentHash: checksum,
        storagePath: storagePath,
        metadata: {
            uploadedFrom: "api",
            notes: body.notes || ""
        },
        versions: [
            {
                version: 1,
                storedName: uniqueName,
                storagePath: storagePath,
                fileSize: file.size,
                checksum,
                uploadedBy: user._id
            }
        ],
        createdBy: user._id,
        updatedBy: user._id
    });

    // Run Supabase upload and indexing in the background asynchronously
    (async () => {
        try {
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            // Once uploaded successfully, trigger background indexing
            indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
                console.error(`Failed to trigger background indexing for ${document._id}:`, err);
            });
        } catch (uploadErr) {
            console.error(`Failed to upload ${document._id} to Supabase in background:`, uploadErr);
            document.embeddingStatus = "failed";
            document.metadata = {
                ...(document.metadata || {}),
                error: `Background upload failed: ${uploadErr.message}`,
                notes: (document.metadata?.notes || "") + `\n[Upload Error: ${uploadErr.message}]`
            };
            await document.save();
        }
    })();

    // Respond immediately with a placeholder signedUrl (real signedUrl is generated on listDocuments dynamically)
    return {
        ...document.toObject(),
        signedUrl: ""
    };
};


const listDocuments = async ({ query, user }) => {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 10000);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status) {
        filter.status = query.status;
    } else {
        filter.status = "active";
    }

    if (query.category) {
        filter.category = sanitizeCategory(query.category);
    }

    if (query.embeddingStatus) {
        filter.embeddingStatus = query.embeddingStatus;
    }

    if (query.search) {
        const cleanSearch = String(query.search).trim();
        const searchRegex = { $regex: cleanSearch, $options: "i" };

        const orConditions = [
            { originalName: searchRegex },
            { category: searchRegex },
            { department: searchRegex },
            { institution: searchRegex },
            { mimeType: searchRegex },
            { "metadata.notes": searchRegex },
            { "metadata.tags": searchRegex }
        ];

        try {
            const { client: qdrantClient, collectionName: qdrantColl } = require("../ai/config/qdrant");
            const embeddingService = require("../ai/services/embeddingService");
            const queryEmbedding = await embeddingService.getQueryEmbedding(cleanSearch).catch(() => null);
            if (queryEmbedding) {
                const results = await qdrantClient.search(qdrantColl, {
                    vector: queryEmbedding,
                    limit: 50,
                    with_payload: true
                }).catch(() => []);
                
                if (Array.isArray(results) && results.length > 0) {
                    const contentDocIds = results.map(r => r.payload?.documentId).filter(Boolean);
                    if (contentDocIds.length > 0) {
                        orConditions.push({ _id: { $in: contentDocIds } });
                    }
                }
            }
        } catch (e) {
            console.error("Qdrant content search failed for query.search:", e);
        }

        if (cleanSearch.match(/^[0-9a-fA-F]{24}$/)) {
            orConditions.push({ _id: cleanSearch });
        }

        filter.$or = orConditions;
    }

    if (query.institution) {
        filter.institution = query.institution;
    } else if (user.institution && query.ignoreInstitution !== "true" && query.ignoreInstitution !== true) {
        filter.institution = user.institution;
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
                .createSignedUrls(paths, Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS) || 315360000);
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
        status: "active"
    });

    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }

    document.status = "archived";
    document.updatedBy = user._id;
    await document.save();

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

    // Rebuild index in Qdrant
    if (file) {
        indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
            console.error(`Failed to trigger re-indexing on document replacement for ${document._id}:`, err);
        });
    } else {
        // Metadata changed. Force a full index rebuild to align metadatas in Qdrant.
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

    // Rebuild index in Qdrant to update originalName metadata
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

    // Rebuild index in Qdrant to update category metadata
    await indexingService.deleteDocumentIndex(document._id);
    indexingService.indexDocumentBackground(document._id).catch(() => {});

    const signedUrl = await getSignedUrlForDoc(newStoragePath);
    return {
        ...document.toObject(),
        signedUrl
    };
};

const copyDocument = async ({ documentId, category, user }) => {
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

    const extension = getSafeExtension(document.originalName);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const newStoragePath = `${targetCategory}/${uniqueName}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .copy(document.storagePath, newStoragePath);

    if (error) {
        const err = new Error(`Failed to copy file in storage: ${error.message}`);
        err.statusCode = 500;
        throw err;
    }

    const newDocument = await Document.create({
        originalName: document.originalName,
        storedName: uniqueName,
        category: targetCategory,
        institution: document.institution,
        department: document.department,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        checksum: document.checksum,
        storagePath: newStoragePath,
        metadata: {
            ...(document.metadata || {}),
            copiedFrom: document._id
        },
        versions: [
            {
                version: 1,
                storedName: uniqueName,
                storagePath: newStoragePath,
                fileSize: document.fileSize,
                checksum: document.checksum,
                uploadedBy: user._id
            }
        ],
        createdBy: user._id,
        updatedBy: user._id
    });

    // Rebuild index in Qdrant
    indexingService.indexDocumentBackground(newDocument._id).catch((err) => {
        console.error(`Failed to trigger background indexing for copied document ${newDocument._id}:`, err);
    });

    const signedUrl = await getSignedUrlForDoc(newStoragePath);
    return {
        ...newDocument.toObject(),
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

const bulkReindex = async ({ category, ids, user }) => {
    const filter = { status: { $ne: "deleted" } };
    if (ids && Array.isArray(ids) && ids.length > 0) {
        filter._id = { $in: ids };
    } else if (category && category !== "root") {
        const cleanCat = sanitizeCategory(category);
        filter.category = { $regex: new RegExp(`^${cleanCat}(_|\/|$)`, "i") };
    }

    const documents = await Document.find(filter);
    for (const doc of documents) {
        doc.embeddingStatus = "pending";
        doc.metadata = {
            ...(doc.metadata || {}),
            indexAttempts: 0,
            lastIndexAttemptAt: null
        };
        await doc.save();
        indexDocumentBackground(doc._id).catch(() => {});
    }
    return { count: documents.length, scope: ids?.length ? "files" : category === "root" ? "root" : "folder" };
};

const getJobsStatus = async () => {
    const activeFilter = { status: { $ne: "deleted" } };
    const [pending, processing, failed, indexedCount, totalCount] = await Promise.all([
        Document.find({ ...activeFilter, embeddingStatus: "pending" }).select("originalName category updatedAt fileSize"),
        Document.find({ ...activeFilter, embeddingStatus: "processing" }).select("originalName category updatedAt fileSize"),
        Document.find({ ...activeFilter, embeddingStatus: "failed" }).select("originalName category updatedAt fileSize metadata.error"),
        Document.countDocuments({ ...activeFilter, embeddingStatus: "indexed" }),
        Document.countDocuments(activeFilter)
    ]);
    return {
        queue: pending,
        running: processing,
        failed: failed,
        completedCount: indexedCount,
        totalCount
    };
};

const retryFailed = async ({ user }) => {
    const failedDocs = await Document.find({ status: { $ne: "deleted" }, embeddingStatus: "failed" });
    for (const doc of failedDocs) {
        doc.embeddingStatus = "pending";
        await doc.save();
        indexDocumentBackground(doc._id).catch(() => {});
    }
    return { count: failedDocs.length };
};

const ignoreFailed = async ({ documentId, user }) => {
    const document = await Document.findOne({ _id: documentId, status: { $ne: "deleted" } });
    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }
    document.embeddingStatus = "not_required";
    document.updatedBy = user._id;
    await document.save();
    return document;
};

const restoreDocument = async ({ documentId, user }) => {
    const document = await Document.findOne({ _id: documentId, status: "archived" });
    if (!document) {
        const error = new Error("Document not found in recycle bin.");
        error.statusCode = 404;
        throw error;
    }
    document.status = "active";
    document.updatedBy = user._id;
    await document.save();
    return document;
};

const permanentDeleteDocument = async ({ documentId, user }) => {
    const document = await Document.findOne({ _id: documentId, status: { $in: ["active", "archived"] } });
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
    await indexingService.deleteDocumentIndex(documentId);
    return document;
};

const duplicateDocument = async ({ documentId, user }) => {
    const document = await Document.findOne({ _id: documentId, status: "active" });
    if (!document) {
        const error = new Error("Document not found.");
        error.statusCode = 404;
        throw error;
    }
    const ext = getSafeExtension(document.originalName);
    const baseName = path.basename(document.originalName, ext);
    const newOriginalName = `${baseName} - Copy${ext}`;
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const newStoragePath = `${document.category}/${uniqueName}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .copy(document.storagePath, newStoragePath);

    if (error) {
        const err = new Error(`Failed to duplicate file in storage: ${error.message}`);
        err.statusCode = 500;
        throw err;
    }

    const newDocument = await Document.create({
        originalName: newOriginalName,
        storedName: uniqueName,
        category: document.category,
        institution: document.institution,
        department: document.department,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        checksum: document.checksum,
        storagePath: newStoragePath,
        createdBy: user._id,
        updatedBy: user._id
    });

    indexingService.indexDocumentBackground(newDocument._id).catch(() => {});
    return newDocument;
};

const bulkMove = async ({ ids, category, user }) => {
    if (!Array.isArray(ids)) throw new Error("ids must be an array");
    const results = [];
    for (const id of ids) {
        try {
            const doc = await moveDocument({ documentId: id, category, user });
            results.push({ id, status: "success", document: doc });
        } catch (error) {
            results.push({ id, status: "failed", error: error.message });
        }
    }
    return results;
};

const bulkCopy = async ({ ids, category, user }) => {
    if (!Array.isArray(ids)) throw new Error("ids must be an array");
    const results = [];
    for (const id of ids) {
        try {
            const doc = await copyDocument({ documentId: id, category, user });
            results.push({ id, status: "success", document: doc });
        } catch (error) {
            results.push({ id, status: "failed", error: error.message });
        }
    }
    return results;
};

const bulkDelete = async ({ ids, user }) => {
    if (!Array.isArray(ids)) throw new Error("ids must be an array");
    const results = [];
    for (const id of ids) {
        try {
            const doc = await archiveDocument({ documentId: id, user });
            results.push({ id, status: "success", document: doc });
        } catch (error) {
            results.push({ id, status: "failed", error: error.message });
        }
    }
    return results;
};

module.exports = {
    uploadDocument,
    listDocuments,
    archiveDocument,
    replaceDocument,
    renameDocument,
    moveDocument,
    copyDocument,
    reindexDocument,
    rebuildAllEmbeddings,
    indexDocumentBackground,
    bulkReindex,
    getJobsStatus,
    retryFailed,
    ignoreFailed,
    restoreDocument,
    permanentDeleteDocument,
    duplicateDocument,
    bulkMove,
    bulkCopy,
    bulkDelete,
    DOCUMENT_CATEGORIES
};
