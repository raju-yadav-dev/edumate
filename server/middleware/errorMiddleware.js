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
    const message = error.message || "Internal Server Error";

    return sendError(res, statusCode, message, {
        stack: error.stack,
        details: error.errors || null
    });
};

module.exports = {
    notFound,
    errorHandler
};
