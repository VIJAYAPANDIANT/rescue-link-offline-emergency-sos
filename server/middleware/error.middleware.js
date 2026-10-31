/**
 * Central Error-Handling Middleware
 * Captures synchronous and unhandled asynchronous errors across Express routes.
 * In production mode, masks internal exception traces and path details.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === 'production';

  // Structured sanitized server-side log
  console.error(`[Error] [${req.method}] ${req.originalUrl}:`, err.message || err);

  const safeMessage = (isProduction && statusCode === 500)
    ? 'An unexpected internal server error occurred. Please contact system support.'
    : err.message || 'An unexpected internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: {
      message: safeMessage,
      code: err.code || 'INTERNAL_SERVER_ERROR',
      ...(err.details && { details: err.details }),
      ...(!isProduction && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = errorHandler;
