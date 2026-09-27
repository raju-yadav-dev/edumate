const AuditLog = require("../models/AuditLog");

const AUDIT_ACTIONS = Object.freeze({
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAILURE: "LOGIN_FAILURE",
    SIGNUP_SUCCESS: "SIGNUP_SUCCESS",
    LOGOUT: "LOGOUT",
    LOGOUT_ALL: "LOGOUT_ALL",
    TOKEN_REFRESH: "TOKEN_REFRESH",
    ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
    ACCOUNT_UNLOCKED: "ACCOUNT_UNLOCKED",
    ROLE_CHANGED: "ROLE_CHANGED",
    USER_DISABLED: "USER_DISABLED",
    USER_ENABLED: "USER_ENABLED",
    DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
    DOCUMENT_DELETED: "DOCUMENT_DELETED",
    DOCUMENT_RENAMED: "DOCUMENT_RENAMED",
    DOCUMENT_MOVED: "DOCUMENT_MOVED",
    RECHUNK_STARTED: "RECHUNK_STARTED",
    KNOWLEDGE_REPAIRED: "KNOWLEDGE_REPAIRED",
    PERMISSION_DENIED: "PERMISSION_DENIED"
});

const logAuditEvent = async ({
    userId = null,
    email = "",
    role = "unknown",
    action,
    resourceType = "",
    resourceId = "",
    ipAddress = "",
    userAgent = "",
    success = true,
    errorCode = "",
    metadata = {}
}) => {
    try {
        await AuditLog.create({
            userId,
            email,
            role,
            action,
            resourceType,
            resourceId,
            ipAddress,
            userAgent,
            success,
            errorCode,
            metadata,
            timestamp: new Date()
        });
    } catch (err) {
        console.error("[AuditService] Failed to record audit log:", err.message);
    }
};

const getAuditLogs = async (query = {}, { page = 1, limit = 50 } = {}) => {
    const filter = {};
    if (query.userId) filter.userId = query.userId;
    if (query.action) filter.action = query.action;
    if (query.role) filter.role = query.role;
    if (query.email) filter.email = { $regex: new RegExp(query.email, "i") };

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        AuditLog.countDocuments(filter)
    ]);

    return {
        logs,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

module.exports = {
    AUDIT_ACTIONS,
    logAuditEvent,
    getAuditLogs
};
