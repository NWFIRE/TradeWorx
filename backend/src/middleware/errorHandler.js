import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    // Default to 500 server error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // PostgreSQL Error Handling (e.g., unique constraint violation)
    if (err.code === '23505') {
        statusCode = 409;
        message = 'Conflict: Duplicate entry exists.';
    }

    // Log the error
    if (statusCode >= 500) {
        logger.error({ err, req: { method: req.method, url: req.url } }, 'Internal Server Error');
    } else {
        logger.warn({ err, req: { method: req.method, url: req.url } }, 'Client Error');
    }

    // Send formatted response (never expose stack trace in production)
    const response = {
        data: null,
        error: message
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};
