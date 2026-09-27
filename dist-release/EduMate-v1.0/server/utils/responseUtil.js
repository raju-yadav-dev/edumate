/**
 * Response Utility — Standardized JSON API Response Helper
 * EduMate Production Backend
 */

/**
 * Send standard success response
 */
const sendSuccess = (res, statusCode = 200, message = "Success", data = null, metadata = null, pagination = null) => {
    const payload = {
        success: true,
        message,
        timestamp: new Date().toISOString()
    };

    if (data !== null) {
        payload.data = data;
    }

    if (metadata !== null) {
        payload.metadata = metadata;
    }

    if (pagination !== null) {
        payload.pagination = pagination;
    }

    payload.errors = null;

    return res.status(statusCode).json(payload);
};

/**
 * Send standard error response
 */
const sendError = (res, statusCode = 500, message = "Internal Server Error", errors = null) => {
    const payload = {
        success: false,
        message,
        data: null,
        errors,
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(payload);
};

/**
 * Semantic helper: Success response
 */
const successResponse = (res, message = "Success", data = null, statusCode = 200) => {
    return sendSuccess(res, statusCode, message, data);
};

/**
 * Semantic helper: Error response
 */
const errorResponse = (res, message = "Internal Server Error", statusCode = 500, errors = null) => {
    return sendError(res, statusCode, message, errors);
};

/**
 * Semantic helper: Validation error response (422 / 400)
 */
const validationError = (res, message = "Validation Error", errors = null) => {
    return sendError(res, 400, message, errors);
};

/**
 * Semantic helper: Not found response (404)
 */
const notFoundResponse = (res, message = "Resource not found") => {
    return sendError(res, 404, message);
};

module.exports = {
    sendSuccess,
    sendError,
    successResponse,
    errorResponse,
    validationError,
    notFoundResponse
};
