import { getApiRootUrl } from "../services/apiConfig";
import { getAdminAccessToken } from "../services/adminSession";

const API_ROOT = getApiRootUrl();
const CRAWLER_API_BASE_URL = `${API_ROOT}/crawler`;

async function parseResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const validationDetails = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
        const error = new Error(`${payload.message || fallbackMessage}${validationDetails}`);
        error.status = response.status;
        throw error;
    }
    return payload;
}

export async function getCrawlJobs() {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/jobs`, {
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Unable to retrieve crawl jobs.");
}

export async function startCrawl(data) {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAdminAccessToken()}`
        },
        body: JSON.stringify(data)
    });
    return parseResponse(response, "Failed to start crawl job.");
}

export async function getCrawlJobDetails(jobId) {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/jobs/${jobId}`, {
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Unable to retrieve crawl job details.");
}

export async function cancelCrawlJob(jobId) {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Failed to cancel crawl job.");
}

export async function recrawlCrawlJob(jobId) {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/jobs/${jobId}/recrawl`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Failed to recrawl crawl job.");
}

export async function deleteCrawlJob(jobId) {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Failed to delete crawl job history.");
}

export async function recrawlAllCrawlerJobs() {
    const response = await fetch(`${CRAWLER_API_BASE_URL}/recrawl-all`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${getAdminAccessToken()}`
        }
    });
    return parseResponse(response, "Failed to start re-crawl of all pages.");
}
