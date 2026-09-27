const healthService = require("../services/healthService");

const getSystemHealth = async (req, res) => {
    try {
        const force = req.query.force === "true";
        const report = await healthService.getSystemHealthReport({ force });
        
        // Return comprehensive health dashboard response
        return res.status(200).json({
            success: true,
            overallStatus: report.overallStatus,
            status: report.overallStatus,
            message: `EduMate System Health: ${report.overallStatus.toUpperCase()}`,
            serviceStatus: report.serviceStatus,
            services: report.services,
            memoryUsage: report.memoryUsage,
            queueStatus: report.queueStatus,
            uptime: report.uptime,
            uptimeFormatted: report.uptimeFormatted,
            retrievalLatencyAverage: report.retrievalLatencyAverage,
            llmLatencyAverage: report.llmLatencyAverage,
            circuitBreaker: report.circuitBreaker,
            data: {
                overallStatus: report.overallStatus,
                status: report.overallStatus,
                serviceStatus: report.serviceStatus,
                services: {
                    mongodb: report.services.mongodb.status,
                    qdrant: report.services.qdrant.status,
                    llamaCpp: report.services.llamaCpp.status === "connected" 
                        ? `connected (${report.services.llamaCpp.provider} - ${report.services.llamaCpp.model})`
                        : "disconnected",
                    storage: report.services.storage.status,
                    embedding: report.services.embedding.status,
                    details: report.services
                },
                memoryUsage: report.memoryUsage,
                queueStatus: report.queueStatus,
                uptime: report.uptime,
                retrievalLatencyAverage: report.retrievalLatencyAverage,
                llmLatencyAverage: report.llmLatencyAverage,
                circuitBreaker: report.circuitBreaker,
                queue: report.queue,
                memory: report.memory,
                timestamp: report.timestamp
            },
            timestamp: report.timestamp,
            errors: null
        });
    } catch (err) {
        console.error("[System Health] Failed to compile health report:", err);
        return res.status(500).json({
            success: false,
            overallStatus: "unhealthy",
            status: "unhealthy",
            message: "Failed to compile system health diagnostics",
            error: err.message
        });
    }
};

module.exports = {
    getSystemHealth
};


