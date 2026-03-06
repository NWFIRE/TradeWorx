export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        // Determines if the stack trace should be shown/logged based on error type
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}
