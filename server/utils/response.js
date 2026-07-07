const sendSuccess = (res, statusCode, message, data = null, metadata = null, pagination = null) => {
    const payload = {
        success: true,
        message
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

const sendError = (res, statusCode, message, errors = null) => {
    const payload = {
        success: false,
        message,
        data: null,
        errors
    };

    return res.status(statusCode).json(payload);
};

module.exports = {
    sendSuccess,
    sendError
};
