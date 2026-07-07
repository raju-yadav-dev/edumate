const { sendError } = require("../utils/response");

const notFound = (req, res) => {
    return sendError(res, 404, `Route not found: ${req.originalUrl}`);
};

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    console.error(error);

    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? "Internal Server Error" : error.message;

    return sendError(res, statusCode, message, error.errors || null);
};

module.exports = {
    notFound,
    errorHandler
};
