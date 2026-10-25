/**
 * 404 Not Found Middleware
 * Standardizes 404 responses for unrecognized routes.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found on this server.`,
    },
  });
};

module.exports = notFoundHandler;
