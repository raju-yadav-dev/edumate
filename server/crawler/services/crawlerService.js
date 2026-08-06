const crypto = require("crypto");
const path = require("path");
const CrawlJob = require("../models/CrawlJob");
const Document = require("../../models/Document");
const supabase = require("../../config/supabase");
const { client: qdrantClient, collectionName: qdrantCollection } = require("../../ai/config/qdrant");
const embeddingService = require("../../ai/services/embeddingService");
const indexingService = require("../../ai/services/indexingService");
const { RecursiveCharacterTextSplitter } = require("../../ai/utils/chunkDocument");
const metadataBuilder = require("../../ai/utils/metadataBuilder");
const WebsiteCrawler = require("../WebsiteCrawler");
const UniversalExtractor = require("../extractors/UniversalExtractor");
const KnowledgeSource = require("../../models/KnowledgeSource");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || "documents";

/**
 * Normalizes a URL by stripping hashes and trailing slashes.
 */
const normalizeUrl = (urlStr) => {
    try {
        const parsed = new URL(urlStr);
        parsed.hash = "";
        let href = parsed.href;
        if (href.endsWith("/")) {
            href = href.slice(0, -1);
        }
        return href;
    } catch {
        return null;
    }
};

/**
 * Helper to upload a buffer to Supabase storage.
 */
const uploadBufferToSupabase = async (buffer, storagePath, mimeType) => {
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false
        });

    if (error) {
        throw error;
    }

    return {
        size: buffer.length,
        checksum: crypto.createHash("sha256").update(buffer).digest("hex")
    };
};

/**
 * Runs a crawl job in the background.
 */
const runCrawlBackground = async (jobId) => {
    const job = await CrawlJob.findById(jobId);
    if (!job) return;

    // Define stats tracker variables
    let pagesCount = 0;
    let docsCount = 0;
    let chunksCount = 0;
    let embeddingsCount = 0;
    let storageUsed = 0;
    let skippedCount = 0;
    let downloadedCount = 0;
    const errorsList = [];
    
    // Arrays to track resources visited during this run for incremental cleanup
    const crawledUrlsInThisRun = [];
    const processedDocUrlsInThisRun = [];

    try {
        job.status = "crawling";
        await job.save();

        console.log(`[CrawlerService] Starting WebsiteCrawler for start URL: ${job.url} with maxPages limit: ${job.maxPages}`);
        
        const crawlerInstance = new WebsiteCrawler({
            startUrl: job.url,
            maxPages: job.maxPages,
            maxDepth: 3,
            delayMs: 1000 // Enforce a 1s crawl delay rate-limit
        });

        const stats = await crawlerInstance.crawl({
            onPage: async ({ url, title, content }) => {
                crawledUrlsInThisRun.push(url);
                const documentName = `${title}.pdf`;
                const textBuffer = Buffer.from(content, "utf-8");
                const checksum = crypto.createHash("sha256").update(textBuffer).digest("hex");

                // 1. Check duplicate page content (Incremental Sync check)
                const existingPage = await Document.findOne({
                    "metadata.sourceUrl": url,
                    status: { $ne: "deleted" }
                });

                if (existingPage) {
                    if (existingPage.checksum === checksum) {
                        console.log(`[CrawlerService] Incremental Sync: HTML page unchanged. Skipping: ${url}`);
                        skippedCount++;
                        pagesCount++;
                        return;
                    }

                    // Content changed: Perform Update (overwrite) by deleting old index
                    console.log(`[CrawlerService] Incremental Sync: HTML page updated. Overwriting: ${url}`);
                    await indexingService.deleteDocumentIndex(existingPage._id);
                    await supabase.storage.from(BUCKET).remove([existingPage.storagePath]);
                    await Document.deleteOne({ _id: existingPage._id });
                }

                downloadedCount++;

                // Upload clean text to Supabase storage
                const uniqueFilename = `${Date.now()}-${crypto.randomUUID()}.txt`;
                const storagePath = `crawler-pages/${uniqueFilename}`;
                const uploadResult = await uploadBufferToSupabase(textBuffer, storagePath, "text/plain");
                storageUsed += uploadResult.size;

                // Create MongoDB document registry
                const document = await Document.create({
                    originalName: documentName,
                    storedName: uniqueFilename,
                    category: job.category,
                    institution: job.institution || "",
                    department: "",
                    mimeType: "text/plain",
                    fileSize: uploadResult.size,
                    checksum: uploadResult.checksum,
                    storagePath,
                    embeddingStatus: "processing",
                    metadata: {
                        uploadedFrom: "crawler",
                        sourceUrl: url,
                        crawlJobId: String(job._id),
                        notes: `Crawled page HTML content`
                    },
                    createdBy: job.createdBy,
                    updatedBy: job.createdBy
                });

                // Generate embeddings and insert chunks into Qdrant
                const splitter = new RecursiveCharacterTextSplitter();
                const splitTexts = splitter.splitText(content);
                chunksCount += splitTexts.length;

                if (splitTexts.length > 0) {
                    const embeddings = await embeddingService.getChunksEmbeddings(splitTexts);
                    const points = [];
                    const timestamp = new Date().toISOString();

                    for (let i = 0; i < splitTexts.length; i++) {
                        const pointId = crypto.randomUUID();
                        const meta = metadataBuilder.buildMetadata({
                            documentId: String(document._id),
                            originalName: documentName,
                            pageNumber: 1,
                            category: job.category,
                            department: "",
                            institution: job.institution || "",
                            uploadedBy: String(job.createdBy)
                        });

                        points.push({
                            id: pointId,
                            vector: embeddings[i],
                            payload: {
                                id: pointId,
                                documentId: meta.documentId,
                                content: splitTexts[i],
                                originalName: meta.originalName,
                                pageNumber: meta.pageNumber,
                                category: meta.category,
                                department: meta.department,
                                institution: meta.institution,
                                uploadedBy: meta.uploadedBy,
                                chunkIndex: i,
                                createdAt: timestamp
                            }
                        });
                    }

                    await qdrantClient.upsert(qdrantCollection, {
                        wait: true,
                        points
                    });
                    embeddingsCount += points.length;
                }

                document.embeddingStatus = "indexed";
                document.chunkCount = splitTexts.length;
                await document.save();
                pagesCount++;
                console.log(`[CrawlerService] Webpage successfully saved and indexed: ${url}`);
            },
            onDocument: async (docUrl) => {
                processedDocUrlsInThisRun.push(docUrl);
                console.log(`[CrawlerService] Document detected: ${docUrl}`);

                let headHeaders = {};
                try {
                    // 1. HEAD request for cache tags
                    const headResponse = await fetch(docUrl, {
                        method: "HEAD",
                        headers: { "User-Agent": "Mozilla/5.0" },
                        signal: AbortSignal.timeout(8000)
                    });

                    if (headResponse.ok) {
                        headHeaders = {
                            etag: headResponse.headers.get("etag") || "",
                            lastModified: headResponse.headers.get("last-modified") || "",
                            contentLength: headResponse.headers.get("content-length") || ""
                        };
                    }
                } catch (headErr) {
                    console.log(`[CrawlerService] HEAD check failed for ${docUrl}, proceeding with direct fetch: ${headErr.message}`);
                }

                // 2. Query MongoDB for matching source cache headers
                if (headHeaders.etag || headHeaders.lastModified || headHeaders.contentLength) {
                    const cacheMatch = await Document.findOne({
                        "metadata.sourceUrl": docUrl,
                        status: { $ne: "deleted" },
                        $or: [
                            { "metadata.etag": headHeaders.etag, "metadata.etag": { $ne: "" } },
                            { "metadata.lastModified": headHeaders.lastModified, "metadata.lastModified": { $ne: "" } }
                        ]
                    });

                    if (cacheMatch) {
                        console.log(`[CrawlerService] Smart Cache HIT for document: ${docUrl}. Skipping re-processing.`);
                        skippedCount++;
                        docsCount++;
                        return;
                    }
                }

                // 3. Cache MISS: Download original file buffer
                console.log(`[CrawlerService] Smart Cache MISS. Downloading document: ${docUrl}`);
                downloadedCount++;
                const fileResponse = await fetch(docUrl, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    signal: AbortSignal.timeout(20000)
                });

                if (!fileResponse.ok) {
                    throw new Error(`Failed to download file. HTTP Status ${fileResponse.status}`);
                }

                const arrayBuffer = await fileResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

                // Double check cache using content checksum
                const duplicateByHash = await Document.findOne({
                    checksum,
                    institution: job.institution || "",
                    status: { $ne: "deleted" }
                });

                if (duplicateByHash) {
                    console.log(`[CrawlerService] Duplicate document file checksum hash detected for: ${docUrl}. Reusing database record.`);
                    duplicateByHash.metadata = {
                        ...(duplicateByHash.metadata || {}),
                        sourceUrl: docUrl
                    };
                    await duplicateByHash.save();
                    skippedCount++;
                    docsCount++;
                    return;
                }

                // 4. Overwrite old document registry if sourceUrl exists (Updated Document check)
                const oldDocRecord = await Document.findOne({
                    "metadata.sourceUrl": docUrl,
                    status: { $ne: "deleted" }
                });

                if (oldDocRecord) {
                    console.log(`[CrawlerService] Incremental Sync: Document updated. Overwriting: ${docUrl}`);
                    await indexingService.deleteDocumentIndex(oldDocRecord._id);
                    await supabase.storage.from(BUCKET).remove([oldDocRecord.storagePath]);
                    await Document.deleteOne({ _id: oldDocRecord._id });
                }

                // 5. Determine file naming and upload original file to Supabase
                const parsedUrl = new URL(docUrl);
                const originalName = path.basename(parsedUrl.pathname) || "document";
                const fileExt = path.extname(originalName) || ".txt";
                const uniqueName = `${Date.now()}-${crypto.randomUUID()}${fileExt}`;
                const storagePath = `${job.category}/${uniqueName}`;
                const mimeType = fileResponse.headers.get("content-type") || "application/octet-stream";

                console.log(`[CrawlerService] Uploading original document file to Supabase: ${storagePath}`);
                const uploadResult = await uploadBufferToSupabase(buffer, storagePath, mimeType);
                storageUsed += uploadResult.size;

                // 6. Run universal text extraction
                console.log(`[CrawlerService] Running UniversalExtractor on document: ${originalName}`);
                const extractionResult = await UniversalExtractor.extract(buffer, originalName);

                // Create MongoDB document registry
                const document = await Document.create({
                    originalName,
                    storedName: uniqueName,
                    category: job.category,
                    institution: job.institution || "",
                    department: "",
                    mimeType,
                    fileSize: uploadResult.size,
                    checksum: uploadResult.checksum,
                    storagePath,
                    embeddingStatus: "processing",
                    metadata: {
                        uploadedFrom: "crawler",
                        sourceUrl: docUrl,
                        crawlJobId: String(job._id),
                        etag: headHeaders.etag || fileResponse.headers.get("etag") || "",
                        lastModified: headHeaders.lastModified || fileResponse.headers.get("last-modified") || "",
                        contentLength: headHeaders.contentLength || fileResponse.headers.get("content-length") || String(buffer.length),
                        documentType: extractionResult.documentType
                    },
                    createdBy: job.createdBy,
                    updatedBy: job.createdBy
                });

                // 7. Chunk text and generate embeddings
                const splitter = new RecursiveCharacterTextSplitter();
                const splitTexts = splitter.splitText(extractionResult.text || "Empty file content.");
                chunksCount += splitTexts.length;

                if (splitTexts.length > 0) {
                    const embeddings = await embeddingService.getChunksEmbeddings(splitTexts);
                    const points = [];
                    const timestamp = new Date().toISOString();

                    for (let i = 0; i < splitTexts.length; i++) {
                        const pointId = crypto.randomUUID();
                        const meta = metadataBuilder.buildMetadata({
                            documentId: String(document._id),
                            originalName,
                            pageNumber: 1,
                            category: job.category,
                            department: "",
                            institution: job.institution || "",
                            uploadedBy: String(job.createdBy)
                        });

                        points.push({
                            id: pointId,
                            vector: embeddings[i],
                            payload: {
                                id: pointId,
                                documentId: meta.documentId,
                                content: splitTexts[i],
                                originalName: meta.originalName,
                                pageNumber: meta.pageNumber,
                                category: meta.category,
                                department: meta.department,
                                institution: meta.institution,
                                uploadedBy: meta.uploadedBy,
                                chunkIndex: i,
                                createdAt: timestamp
                            }
                        });
                    }

                    await qdrantClient.upsert(qdrantCollection, {
                        wait: true,
                        points
                    });
                    embeddingsCount += points.length;
                }

                document.embeddingStatus = "indexed";
                document.chunkCount = splitTexts.length;
                await document.save();
                docsCount++;
                console.log(`[CrawlerService] Document successfully extracted, uploaded, and indexed: ${originalName}`);
            },
            onProgress: (progressStats) => {
                job.pagesCrawled = progressStats.pagesCrawled;
                job.crawledUrls = progressStats.crawledUrls;
                
                // Track discovered files and depth in job metadata
                job.metadata = {
                    ...(job.metadata || {}),
                    discoveredDocumentsCount: progressStats.discoveredDocuments.length,
                    discoveredDocuments: progressStats.discoveredDocuments
                };
                
                job.save().catch((err) => {
                    console.error("[CrawlerService] Failed to update progress:", err.message);
                });
            }
        });

        // 8. Incremental Sync: Detect and purge Deleted Pages (missing from current crawl)
        console.log("[CrawlerService] Incremental Sync: Checking for deleted pages/documents...");
        const startOrigin = new URL(job.url).origin;
        const allOldCrawlerDocs = await Document.find({
            "metadata.uploadedFrom": "crawler",
            status: { $ne: "deleted" }
        });

        const docsToDelete = allOldCrawlerDocs.filter(doc => {
            try {
                const docUrl = doc.metadata?.sourceUrl;
                if (!docUrl) return false;
                const docOrigin = new URL(docUrl).origin;
                if (docOrigin !== startOrigin) return false;
                // Delete if not crawled in this run
                return !crawledUrlsInThisRun.includes(docUrl) && !processedDocUrlsInThisRun.includes(docUrl);
            } catch {
                return false;
            }
        });

        console.log(`[CrawlerService] Incremental Sync: Found ${docsToDelete.length} obsolete pages/documents to delete.`);
        for (const doc of docsToDelete) {
            console.log(`- Deleting obsolete resource: ${doc.metadata.sourceUrl}`);
            await indexingService.deleteDocumentIndex(doc._id);
            await supabase.storage.from(BUCKET).remove([doc.storagePath]);
            doc.status = "deleted";
            await doc.save();
        }

        // 9. Update stats in website source config manager
        await KnowledgeSource.findOneAndUpdate(
            { type: "url", url: job.url },
            {
                crawlStatus: "completed",
                lastSyncAt: new Date(),
                stats: {
                    pages: pagesCount,
                    documents: docsCount,
                    chunks: chunksCount,
                    embeddings: embeddingsCount,
                    storageUsed,
                    skipped: skippedCount,
                    downloaded: downloadedCount,
                    errors: errorsList
                }
            }
        );

        job.status = "completed";
        job.pagesCrawled = stats.pagesCrawled;
        job.crawledUrls = stats.crawledUrls;
        await job.save();
        console.log(`[CrawlerService] Sync finished for Job ID ${jobId}. Pages: ${pagesCount} | Documents: ${docsCount} | Skipped: ${skippedCount} | Downloaded: ${downloadedCount}`);
    } catch (err) {
        console.error(`[CrawlerService] Sync job ${jobId} failed critically:`, err);
        errorsList.push(err.message);
        job.status = "failed";
        job.errors.push(`Critical: ${err.message}`);
        await job.save();
        
        await KnowledgeSource.findOneAndUpdate(
            { type: "url", url: job.url },
            {
                crawlStatus: "failed",
                lastSyncAt: new Date(),
                stats: {
                    pages: pagesCount,
                    documents: docsCount,
                    chunks: chunksCount,
                    embeddings: embeddingsCount,
                    storageUsed,
                    skipped: skippedCount,
                    downloaded: downloadedCount,
                    errors: errorsList
                }
            }
        );
    }
};

/**
 * Creates and schedules a web crawl job.
 */
const startCrawl = async ({ url, maxPages, category, institution, user }) => {
    const normalizedStart = normalizeUrl(url);
    if (!normalizedStart) {
        const error = new Error("Invalid start URL provided.");
        error.statusCode = 400;
        throw error;
    }

    const job = await CrawlJob.create({
        url: normalizedStart,
        maxPages: maxPages || 50,
        category: category || "others",
        institution: institution || user.institution || "",
        createdBy: user._id,
        status: "queued"
    });

    // Run in background asynchronously
    runCrawlBackground(job._id).catch((err) => {
        console.error(`[CrawlerService] Background crawl runtime failure:`, err);
    });

    return job;
};

/**
 * Lists past crawl jobs.
 */
const listCrawlJobs = async ({ user, query }) => {
    const filter = {};
    if (user.role !== "admin" && user.role !== "super_admin") {
        filter.createdBy = user._id;
    }
    if (query.institution) {
        filter.institution = query.institution;
    }

    const jobs = await CrawlJob.find(filter).sort({ createdAt: -1 });
    return jobs;
};

/**
 * Get single crawl job details.
 */
const getCrawlJobDetails = async (jobId) => {
    const job = await CrawlJob.findById(jobId);
    if (!job) {
        const error = new Error("Crawl job not found.");
        error.statusCode = 404;
        throw error;
    }
    return job;
};

module.exports = {
    startCrawl,
    listCrawlJobs,
    getCrawlJobDetails
};
