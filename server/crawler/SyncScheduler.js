const KnowledgeSource = require("../models/KnowledgeSource");
const crawlerService = require("./services/crawlerService");

const checkIsDue = (syncInterval, lastSyncAt) => {
    if (!lastSyncAt) return true; // Never synced before, run now

    const diffMs = Date.now() - new Date(lastSyncAt).getTime();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    switch (syncInterval) {
        case "daily":
            return diffMs >= oneDay;
        case "weekly":
            return diffMs >= 7 * oneDay;
        case "monthly":
            return diffMs >= 30 * oneDay;
        default:
            return false;
    }
};

const scanAndSync = async () => {
    console.log("[SyncScheduler] Starting scheduled sync check...");
    try {
        const activeWebsiteSources = await KnowledgeSource.find({
            type: "url",
            isEnabled: true,
            syncInterval: { $in: ["daily", "weekly", "monthly"] }
        });

        console.log(`[SyncScheduler] Found ${activeWebsiteSources.length} active scheduled websites to scan.`);

        for (const source of activeWebsiteSources) {
            await new Promise(resolve => setImmediate(resolve)); // Yield to keep Express responsive (Requirement 4)
            if (checkIsDue(source.syncInterval, source.lastSyncAt)) {
                console.log(`[SyncScheduler] Source "${source.name}" (${source.url}) is due for sync. Triggering crawler...`);
                
                // Trigger background crawl
                await crawlerService.startCrawl({
                    url: source.url,
                    maxPages: 100, // Default safe range for scheduler runs
                    category: "others",
                    institution: "Heritage",
                    user: { _id: source._id, role: "admin", fullName: "System Scheduler" }
                });

                // Update lastSyncAt optimistically to prevent overlapping triggers
                source.lastSyncAt = new Date();
                await source.save();
            }
        }
    } catch (err) {
        console.error("[SyncScheduler] Scheduled sync run encountered an error:", err.message);
    }
};

const start = () => {
    console.log("[SyncScheduler] Initializing Crawler Background Scheduler...");
    
    // Check every 30 minutes
    setInterval(scanAndSync, 30 * 60 * 1000);
    
    // Run initial check 20 seconds after start
    setTimeout(scanAndSync, 20 * 1000);
};

module.exports = {
    start
};
