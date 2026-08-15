const getCrawlerService = () => require("../services/crawlerService");
const asyncHandler = require("../../utils/asyncHandler");
const { sendSuccess } = require("../../utils/response");

const startCrawl = asyncHandler(async (req, res) => {
    const job = await getCrawlerService().startCrawl({
        url: req.body.url,
        maxPages: req.body.maxPages,
        category: req.body.category,
        institution: req.body.institution,
        user: req.user
    });

    return sendSuccess(res, 201, "Crawl job started successfully.", job);
});

const getCrawlJobs = asyncHandler(async (req, res) => {
    const jobs = await getCrawlerService().listCrawlJobs({
        user: req.user,
        query: req.query
    });

    return sendSuccess(res, 200, "Crawl jobs retrieved successfully.", jobs);
});

const getCrawlJobDetails = asyncHandler(async (req, res) => {
    const job = await getCrawlerService().getCrawlJobDetails(req.params.jobId);

    return sendSuccess(res, 200, "Crawl job details retrieved successfully.", job);
});

const cancelCrawl = asyncHandler(async (req, res) => {
    const job = await getCrawlerService().cancelCrawl({
        jobId: req.params.jobId,
        user: req.user
    });

    return sendSuccess(res, 200, "Crawl job cancelled successfully.", job);
});

const recrawlCrawlJob = asyncHandler(async (req, res) => {
    const job = await getCrawlerService().recrawlCrawlJob({
        jobId: req.params.jobId,
        user: req.user
    });

    return sendSuccess(res, 201, "Crawl job recrawl started successfully.", job);
});

const deleteCrawlJob = asyncHandler(async (req, res) => {
    const result = await getCrawlerService().deleteCrawlJob({
        jobId: req.params.jobId,
        user: req.user
    });

    return sendSuccess(res, 200, "Crawl job history deleted successfully.", result);
});

const recrawlAllJobs = asyncHandler(async (req, res) => {
    const result = await getCrawlerService().recrawlAllJobs({
        user: req.user
    });

    return sendSuccess(res, 201, "All crawl jobs recrawl started successfully.", result);
});

module.exports = {
    startCrawl,
    getCrawlJobs,
    getCrawlJobDetails,
    cancelCrawl,
    recrawlCrawlJob,
    deleteCrawlJob,
    recrawlAllJobs
};
