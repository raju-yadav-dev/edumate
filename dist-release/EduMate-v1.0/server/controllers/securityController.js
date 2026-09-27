/**
 * Security Controller — EduMate Mission 19
 * 
 * Exposes:
 * - Security metrics & telemetry
 * - Audit logs query & filtering
 * - Active sessions management & revocation
 */

const auditLogger = require("../services/auditLogger");
const RefreshToken = require("../models/RefreshToken");
const { sendSuccess, sendError } = require("../utils/responseUtil");

const getSecurityMetrics = async (req, res) => {
    try {
        const metrics = auditLogger.getSecurityMetrics();
        
        // Enrich active sessions count from DB if connected
        try {
            const activeSessionsCount = await RefreshToken.countDocuments({ isRevoked: false });
            metrics.activeSessions = activeSessionsCount || 1;
        } catch (_) {}

        return sendSuccess(res, 200, "Security metrics retrieved successfully.", metrics);
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve security metrics: ${err.message}`);
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const { limit = 50, action, email, success } = req.query || {};
        const logs = auditLogger.getAuditLogs({ limit, action, email, success });
        return sendSuccess(res, 200, "Audit logs retrieved successfully.", { count: logs.length, logs });
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve audit logs: ${err.message}`);
    }
};

const getActiveSessions = async (req, res) => {
    try {
        const sessions = await RefreshToken.find({ isRevoked: false })
            .populate("userId", "fullName email role department institution")
            .sort({ lastUsedAt: -1 })
            .limit(100)
            .lean();

        return sendSuccess(res, 200, "Active sessions retrieved successfully.", { count: sessions.length, sessions });
    } catch (err) {
        return sendError(res, 500, `Failed to retrieve active sessions: ${err.message}`);
    }
};

const revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.body || {};
        if (!sessionId) {
            return sendError(res, 400, "Session ID is required.");
        }

        const result = await RefreshToken.updateMany(
            { sessionId },
            { $set: { isRevoked: true } }
        );

        auditLogger.logEvent({
            action: "SESSION_REVOKED_BY_ADMIN",
            resourceType: "SESSION",
            resourceId: sessionId,
            userId: req.user?._id,
            email: req.user?.email || "admin",
            role: req.user?.role || "admin",
            success: true
        });

        return sendSuccess(res, 200, `Session '${sessionId}' revoked successfully.`, { modifiedCount: result.modifiedCount });
    } catch (err) {
        return sendError(res, 500, `Failed to revoke session: ${err.message}`);
    }
};

module.exports = {
    getSecurityMetrics,
    getAuditLogs,
    getActiveSessions,
    revokeSession
};
