const crypto = require("crypto");
const path = require("path");
const AdmZip = require("adm-zip");
const Document = require("../models/Document");
const localStorageManager = require("../storage/localStorageManager");
const indexingService = require("../ai/services/indexingService");
const cacheService = require("./cacheService");

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
    "crawled",
    "crawle",
    "campus_navigation",
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

const getSignedUrlForDoc = async (storagePath, docId = null) => {
    if (docId) {
        return `/api/documents/download/${docId}`;
    }
    if (storagePath) {
        return `/api/documents/raw/${encodeURIComponent(storagePath)}`;
    }
    return "";
};

const saveToLocalStorage = async (file, category) => {
    const extension = getSafeExtension(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const baseDir = category ? `file_explorer/${category}` : "file_explorer";
    const storagePath = `${baseDir}/${uniqueName}`;

    await localStorageManager.saveFile(storagePath, file.buffer);

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
        status: "active"
    });

    if (duplicate) {
        const error = new Error("This document already exists in the knowledge base.");
        error.statusCode = 409;
        error.duplicateDocument = {
            id: duplicate._id,
            originalName: duplicate.originalName,
            category: duplicate.category,
            institution: duplicate.institution,
            department: duplicate.department
        };
        throw error;
    }

    const category = sanitizeCategory(body.category);
    const extension = getSafeExtension(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const targetFolder = body?.targetFolder || body?.folderPath || body?.folder;
    let baseDir = "file_explorer";
    if (targetFolder) {
        baseDir = targetFolder.replace(/^[/\\]+/, "").replace(/\\/g, "/");
        if (!baseDir.startsWith("file_explorer") && !baseDir.startsWith("storage/file_explorer")) {
            baseDir = `file_explorer/${baseDir}`;
        }
    } else if (category) {
        baseDir = `file_explorer/${category}`;
    }
    const storagePath = `${baseDir}/${uniqueName}`;

    // Write file directly to edumate/storage/file_explorer/...
    await localStorageManager.saveFile(storagePath, file.buffer);

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

    cacheService.invalidateCategory(category);

    // Trigger background indexing with the in-memory buffer
    indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
        console.error(`Failed to trigger background indexing for ${document._id}:`, err);
    });

    const signedUrl = `/api/documents/download/${document._id}`;
    return {
        ...document.toObject(),
        signedUrl
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
        const cat = sanitizeCategory(query.category);
        const escapedCat = cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.category = { $regex: `^${escapedCat}(_|$)`, $options: "i" };
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
            const { client: qdrantClient, collectionName: qdrantColl, formatSearchVector } = require("../ai/config/qdrant");
            const embeddingService = require("../ai/services/embeddingService");
            const queryEmbedding = await embeddingService.getQueryEmbedding(cleanSearch).catch(() => null);
            if (queryEmbedding) {
                const vectorParam = await formatSearchVector(queryEmbedding);
                const results = await qdrantClient.search(qdrantColl, {
                    vector: vectorParam,
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
    } else if (user && user.institution && query.ignoreInstitution !== "true" && query.ignoreInstitution !== true) {
        filter.$or = [
            { institution: user.institution },
            { institution: "" },
            { institution: null },
            { institution: { $exists: false } }
        ];
    }

    const [documents, total] = await Promise.all([
        Document.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit),
        Document.countDocuments(filter)
    ]);

    const documentsWithUrls = documents.map(doc => {
        const docObj = doc.toObject();
        docObj.signedUrl = `/api/documents/download/${doc._id}`;
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
    cacheService.invalidateCategory(document.category);

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
        const uploadResult = await saveToLocalStorage(file, category);
        storedName = uploadResult.storedName;
        storagePath = uploadResult.storagePath;
        fileSize = file.size;
        checksum = getChecksum(file.buffer);
        mimeType = file.mimetype;
        originalName = file.originalname;

        try {
            await localStorageManager.deleteFile(document.storagePath);
        } catch (storageErr) {
            console.error(`Failed to delete old file ${document.storagePath} from local storage:`, storageErr);
        }
    } else if (body.category && body.category !== document.category) {
        const uniqueName = document.storedName;
        const newStoragePath = `${category}/${uniqueName}`;

        try {
            await localStorageManager.moveFile(document.storagePath, newStoragePath);
            storagePath = newStoragePath;
        } catch (error) {
            console.error(`Failed to move file from ${document.storagePath} to ${newStoragePath} in local storage:`, error);
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
    cacheService.invalidateCategory(document.category);
    if (category !== document.category) {
        cacheService.invalidateCategory(category);
    }

    // Rebuild index in Qdrant
    if (file) {
        indexingService.indexDocumentBackground(document._id, file.buffer).catch((err) => {
            console.error(`Failed to trigger re-indexing on document replacement for ${document._id}:`, err);
        });
    } else {
        await indexingService.deleteDocumentIndex(document._id);
        indexingService.indexDocumentBackground(document._id).catch(() => {});
    }

    const signedUrl = `/api/documents/download/${document._id}`;
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
    cacheService.invalidateCategory(document.category);

    await indexingService.deleteDocumentIndex(document._id);
    indexingService.indexDocumentBackground(document._id).catch(() => {});

    const signedUrl = `/api/documents/download/${document._id}`;
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
        const signedUrl = `/api/documents/download/${document._id}`;
        return {
            ...document.toObject(),
            signedUrl
        };
    }

    const oldStoragePath = document.storagePath;
    const newStoragePath = `${targetCategory}/${document.storedName}`;

    try {
        await localStorageManager.moveFile(oldStoragePath, newStoragePath);
    } catch (error) {
        console.warn(`Local file move warning for ${oldStoragePath} -> ${newStoragePath}:`, error.message);
    }

    document.category = targetCategory;
    document.storagePath = newStoragePath;
    document.updatedBy = user._id;
    await document.save();
    cacheService.invalidateCategory(document.category);
    cacheService.invalidateCategory(targetCategory);

    // Update metadata in Qdrant payloads
    try {
        const { client: qdrantClient, collectionName: qdrantCollection } = require("../ai/config/qdrant");
        await qdrantClient.setPayload(qdrantCollection, {
            payload: {
                category: targetCategory,
                department: document.department,
                institution: document.institution
            },
            filter: {
                must: [
                    {
                        key: "documentId",
                        match: { value: String(document._id) }
                    }
                ]
            }
        });
    } catch (qdrantErr) {
        console.error("Failed to update Qdrant payload on move:", qdrantErr.message);
    }

    const signedUrl = `/api/documents/download/${document._id}`;
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

    try {
        await localStorageManager.copyFile(document.storagePath, newStoragePath);
    } catch (error) {
        console.warn(`Local file copy warning for ${document.storagePath} -> ${newStoragePath}:`, error.message);
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

    cacheService.invalidateCategory(targetCategory);

    indexingService.indexDocumentBackground(newDocument._id).catch((err) => {
        console.error(`Failed to trigger background indexing for copied document ${newDocument._id}:`, err);
    });

    const signedUrl = `/api/documents/download/${newDocument._id}`;
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
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { count: 0, scope: ids?.length ? "files" : category === "root" ? "root" : "folder" };
    }

    const filter = { status: { $ne: "deleted" }, _id: { $in: ids } };

    if (category && category !== "root") {
        cacheService.invalidateCategory(category);
    }
    try {
        const docs = await Document.find(filter).select("category").lean();
        for (const d of docs) {
            cacheService.invalidateCategory(d.category);
        }
    } catch (e) {
        console.error("Bulk reindex cache invalidation failed:", e);
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
    return { count: documents.length, scope: "files" };
};

const getJobsStatus = async () => {
    const activeFilter = { status: "active" };
    const [pending, processing, failed, completedCount, totalCount] = await Promise.all([
        Document.find({ ...activeFilter, embeddingStatus: "pending" }).select("originalName category updatedAt fileSize"),
        Document.find({ ...activeFilter, embeddingStatus: "processing" }).select("originalName category updatedAt fileSize"),
        Document.find({ ...activeFilter, embeddingStatus: "failed" }).select("originalName category updatedAt fileSize metadata.error"),
        Document.countDocuments({ ...activeFilter, embeddingStatus: { $in: ["indexed", "not_required"] } }),
        Document.countDocuments(activeFilter)
    ]);
    return {
        queue: pending,
        running: processing,
        failed: failed,
        completedCount,
        totalCount
    };
};

const retryFailed = async ({ user }) => {
    const failedDocs = await Document.find({ status: "active", embeddingStatus: "failed" });
    let count = 0;
    for (const doc of failedDocs) {
        doc.retryCount = (doc.retryCount || 0) + 1;
        doc.embeddingStatus = "pending";
        doc.progress = 0;
        doc.currentStage = `Queued for retry (attempt ${doc.retryCount})`;
        await doc.save();
        indexingService.indexDocumentBackground(doc._id).catch(() => {});
        count++;
    }
    return { count };
};

const ignoreFailed = async ({ documentId, user }) => {
    const document = await Document.findOne({ _id: documentId, status: "active" });
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
    cacheService.invalidateCategory(document.category);
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
        await localStorageManager.deleteFile(document.storagePath);
    } catch (storageErr) {
        console.error(`Failed to delete file ${document.storagePath} from local storage:`, storageErr);
    }
    try {
        const localChunkManager = require("../storage/localChunkManager");
        await localChunkManager.deleteDocumentChunks(documentId);
    } catch (_) {}
    document.status = "deleted";
    document.updatedBy = user._id;
    await document.save();
    cacheService.invalidateCategory(document.category);
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

    try {
        await localStorageManager.copyFile(document.storagePath, newStoragePath);
    } catch (error) {
        console.warn(`Local file duplication copy warning for ${document.storagePath} -> ${newStoragePath}:`, error.message);
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

    cacheService.invalidateCategory(document.category);
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

const getDocumentBuffer = async (doc) => {
    if (!doc.storagePath) {
        throw new Error(`Document ${doc.originalName} does not have a storagePath`);
    }
    return localStorageManager.readFile(doc.storagePath);
};

const downloadZip = async ({ category, ids }) => {
    const query = { status: "active" };

    if (Array.isArray(ids) && ids.length > 0) {
        query._id = { $in: ids };
    } else if (category && typeof category === "string") {
        const trimmed = category.trim().toLowerCase();
        if (trimmed && trimmed !== "all" && trimmed !== "root") {
            const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.category = { $regex: new RegExp(`^${escaped}(/.*)?$`, "i") };
        }
    }

    const documents = await Document.find(query).lean();

    if (!documents || documents.length === 0) {
        const error = new Error("No active documents found to download.");
        error.statusCode = 404;
        throw error;
    }

    const zip = new AdmZip();
    const isRootDownload = !category || category === "all" || category === "root" || category.trim() === "";
    const baseCategory = (!isRootDownload && category) ? category.trim().toLowerCase() : "";

    const filePathsCount = {};

    for (const doc of documents) {
        await new Promise(resolve => setImmediate(resolve));
        try {
            const buffer = await getDocumentBuffer(doc);
            const docCategory = (doc.category || "others").trim().toLowerCase();
            const originalFileName = doc.originalName || doc.storedName || "document.bin";

            let relativeFolderPath = "";

            if (isRootDownload) {
                relativeFolderPath = docCategory;
            } else if (baseCategory) {
                if (docCategory === baseCategory) {
                    relativeFolderPath = "";
                } else if (docCategory.startsWith(`${baseCategory}/`)) {
                    relativeFolderPath = docCategory.slice(baseCategory.length + 1);
                } else {
                    relativeFolderPath = docCategory;
                }
            }

            const folderPrefix = relativeFolderPath ? `${relativeFolderPath}/` : "";
            const rawZipPath = `${folderPrefix}${originalFileName}`;

            let finalFileName = originalFileName;
            if (filePathsCount[rawZipPath]) {
                filePathsCount[rawZipPath] += 1;
                const ext = path.extname(originalFileName);
                const nameWithoutExt = path.basename(originalFileName, ext);
                finalFileName = `${nameWithoutExt} (${filePathsCount[rawZipPath]})${ext}`;
            } else {
                filePathsCount[rawZipPath] = 1;
            }

            const targetZipPath = relativeFolderPath ? `${relativeFolderPath}/${finalFileName}` : finalFileName;
            zip.addFile(targetZipPath, buffer);
        } catch (err) {
            console.error(`[downloadZip] Skipping document ${doc._id} (${doc.originalName}):`, err.message);
        }
    }

    const zipBuffer = zip.toBuffer();

    let exportName = "edumate-documents";
    if (isRootDownload) {
        exportName = "edumate-root-export";
    } else if (baseCategory) {
        exportName = baseCategory.replace(/[^a-z0-9_-]/gi, "_");
    }

    const filename = `${exportName}.zip`;

    return { zipBuffer, filename };
};

const createPlaceholderDocument = async ({ name, category, department, program, user }) => {
    const cleanName = (name || "").trim();
    if (!cleanName) {
        const err = new Error("File name is required.");
        err.statusCode = 400;
        throw err;
    }
    const safeCategory = sanitizeCategory(category);
    const placeholderContent = Buffer.from(`# ${cleanName}\n\n[Placeholder knowledge document created by ${user?.name || "admin"}]\n`);
    const checksum = getChecksum(placeholderContent);

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}.txt`;
    const storagePath = `${safeCategory}/${uniqueName}`;

    try {
        await localStorageManager.saveFile(storagePath, placeholderContent);
    } catch (e) {
        console.warn("[Placeholder] Local storage save warning:", e.message);
    }

    const doc = await Document.create({
        originalName: cleanName.endsWith(".txt") || cleanName.endsWith(".md") || cleanName.includes(".") ? cleanName : `${cleanName}.txt`,
        storedName: uniqueName,
        category: safeCategory,
        institution: user?.institution || "",
        department: department || user?.department || "General",
        program: program || "General",
        mimeType: "text/plain",
        fileSize: placeholderContent.length,
        checksum,
        storagePath,
        uploadedBy: user?.userId || user?._id,
        status: "active",
        embeddingStatus: "pending",
        progress: 0,
        currentStage: "Pending",
        chunksCount: 0
    });

    return doc;
};

const renameFolder = async ({ oldPath, newPath, user }) => {
    if (!oldPath || !newPath) {
        const err = new Error("Both oldPath and newPath are required.");
        err.statusCode = 400;
        throw err;
    }
    const cleanOld = sanitizeCategory(oldPath);
    const cleanNew = sanitizeCategory(newPath);

    if (cleanOld === cleanNew) return { modifiedCount: 0 };

    try {
        await localStorageManager.moveFile(cleanOld, cleanNew);
    } catch (err) {
        console.warn(`Local directory rename warning for ${cleanOld} -> ${cleanNew}:`, err.message);
    }

    const docs = await Document.find({
        status: { $ne: "deleted" },
        $or: [
            { category: cleanOld },
            { category: new RegExp(`^${cleanOld}/`) }
        ]
    });

    let count = 0;
    for (const doc of docs) {
        let updatedCategory = doc.category;
        if (doc.category === cleanOld) {
            updatedCategory = cleanNew;
        } else if (doc.category.startsWith(`${cleanOld}/`)) {
            updatedCategory = `${cleanNew}${doc.category.slice(cleanOld.length)}`;
        }
        doc.category = updatedCategory;
        if (doc.storagePath && doc.storagePath.startsWith(`${cleanOld}/`)) {
            doc.storagePath = `${cleanNew}/${doc.storagePath.slice(cleanOld.length + 1)}`;
        }
        await doc.save();
        count++;
    }

    return { modifiedCount: count, oldCategory: cleanOld, newCategory: cleanNew };
};

const deleteFolder = async ({ folderPath, user }) => {
    if (!folderPath) {
        const err = new Error("folderPath is required.");
        err.statusCode = 400;
        throw err;
    }
    const cleanPath = sanitizeCategory(folderPath);

    try {
        await localStorageManager.deleteFolder(cleanPath);
    } catch (err) {
        console.warn(`Local directory delete warning for ${cleanPath}:`, err.message);
    }

    const docs = await Document.find({
        status: { $ne: "deleted" },
        $or: [
            { category: cleanPath },
            { category: new RegExp(`^${cleanPath}/`) }
        ]
    });

    const docIds = docs.map(d => d._id);
    if (docIds.length > 0) {
        await Document.updateMany(
            { _id: { $in: docIds } },
            { $set: { status: "deleted", deletedAt: new Date() } }
        );
    }

    return { deletedCount: docIds.length, folderPath: cleanPath, deletedIds: docIds };
};

const bulkRestore = async ({ ids, user }) => {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        const err = new Error("List of document IDs is required.");
        err.statusCode = 400;
        throw err;
    }

    const result = await Document.updateMany(
        { _id: { $in: ids } },
        { $set: { status: "active", deletedAt: null } }
    );

    return { restoredCount: result.modifiedCount };
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
    bulkRestore,
    createPlaceholderDocument,
    renameFolder,
    deleteFolder,
    downloadZip,
    getDocumentBuffer,
    DOCUMENT_CATEGORIES
};
