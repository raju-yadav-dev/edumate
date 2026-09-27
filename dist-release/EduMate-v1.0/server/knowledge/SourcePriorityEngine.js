const KnowledgeSource = require("../models/KnowledgeSource");

/**
 * Seeds default knowledge sources if collection is empty
 */
const seedDefaultSources = async () => {
    const count = await KnowledgeSource.countDocuments();
    if (count > 0) return;

    console.log("[SourcePriorityEngine] Seeding default knowledge sources...");
    await KnowledgeSource.create([
        {
            type: "pdf",
            name: "Uploaded PDFs",
            priority: 1,
            isEnabled: true,
            crawlStatus: "not_applicable"
        },
        {
            type: "url",
            name: "Approved Website URLs (e.g. Official University Pages)",
            url: "https://heritageit.edu/",
            priority: 2,
            isEnabled: true,
            crawlStatus: "completed"
        },
        {
            type: "internet",
            name: "Internet Search",
            priority: 3,
            isEnabled: true,
            crawlStatus: "not_applicable"
        }
    ]);
    console.log("[SourcePriorityEngine] Default sources seeded.");
};

/**
 * Gets all active sources sorted by priority
 */
const getSources = async () => {
    await seedDefaultSources();
    return KnowledgeSource.find().sort({ priority: 1 });
};

/**
 * Updates priority ranks of sources
 */
const updatePriorities = async (priorityOrders) => {
    // priorityOrders = [{ id: "...", priority: 1 }, { id: "...", priority: 2 }]
    for (const order of priorityOrders) {
        await KnowledgeSource.findByIdAndUpdate(order.id, { priority: order.priority });
    }
    return getSources();
};

/**
 * Updates a single source properties (e.g. isEnabled, priority, name, url)
 */
const updateSource = async (sourceId, updates) => {
    const source = await KnowledgeSource.findByIdAndUpdate(sourceId, updates, { new: true });
    if (!source) {
        const error = new Error("Knowledge source not found.");
        error.statusCode = 404;
        throw error;
    }
    return source;
};

/**
 * Adds an approved website URL source
 */
const addWebsiteUrl = async ({ name, url, priority }) => {
    // If no priority specified, place it after existing URL sources
    let targetPriority = priority;
    if (!targetPriority) {
        const urlSources = await KnowledgeSource.find({ type: "url" }).sort({ priority: -1 }).limit(1);
        targetPriority = urlSources.length > 0 ? urlSources[0].priority : 2;
    }

    const newSource = await KnowledgeSource.create({
        type: "url",
        name: name || "University Webpage",
        url: url,
        priority: targetPriority,
        isEnabled: true,
        crawlStatus: "pending"
    });

    return newSource;
};

/**
 * Deletes an approved website URL source
 */
const deleteSource = async (sourceId) => {
    const result = await KnowledgeSource.findByIdAndDelete(sourceId);
    if (!result) {
        const error = new Error("Source not found.");
        error.statusCode = 404;
        throw error;
    }
    return result;
};

module.exports = {
    seedDefaultSources,
    getSources,
    updatePriorities,
    updateSource,
    addWebsiteUrl,
    deleteSource
};
