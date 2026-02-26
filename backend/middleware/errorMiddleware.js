const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Joi validation errors
    if (err.isJoi) {
        statusCode = 400;
        message = err.details.map(detail => detail.message).join(', ');
    }

    // Handle Supabase/DB Unique Constraint Errors
    if (err.code === '23505') {
        statusCode = 400;
        message = 'Duplicate entry found. This record already exists.';
    }

    // Log the error internally
    const logMeta = {
        path: req ? req.path : 'unknown',
        method: req ? req.method : 'unknown',
        statusCode,
        requestId: req ? req.id : 'none'
    };

    if (process.env.NODE_ENV !== 'production' && err.stack) {
        logMeta.stack = err.stack;
    }

    logger.error(`[ErrorHandler] ${err.name || 'Error'}: ${err.message}`, logMeta);

    // Mask internal error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal Server Error';
    }

    return res.status(statusCode).json({
        success: false,
        message,
        requestId: req.id, // Return request ID for debugging
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = { errorHandler };
