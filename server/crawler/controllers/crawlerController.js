const crawlerService = require("../services/crawlerService");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");

const startCrawl = asyncHandler(async (req, res) => {
    const job = await crawlerService.startCrawl({
        url: req.body.url,
        maxPages: req.body.maxPages,
        category: req.body.category,
        institution: req.body.institution,
        user: req.user
    });

    return sendSuccess(res, 201, "Crawl job started successfully.", job);
});

const getCrawlJobs = asyncHandler(async (req, res) => {
    const jobs = await crawlerService.listCrawlJobs({
        user: req.user,
        query: req.query
    });

    return sendSuccess(res, 200, "Crawl jobs retrieved successfully.", jobs);
});

const getCrawlJobDetails = asyncHandler(async (req, res) => {
    const job = await crawlerService.getCrawlJobDetails(req.params.jobId);

    return sendSuccess(res, 200, "Crawl job details retrieved successfully.", job);
});

module.exports = {
    startCrawl,
    getCrawlJobs,
    getCrawlJobDetails
};
