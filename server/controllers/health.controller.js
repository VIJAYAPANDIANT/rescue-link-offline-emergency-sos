/**
 * Health Controller
 * Provides health and status verification for the RescueLink API.
 */
const getHealthStatus = (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());

  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'RescueLink Emergency SOS Backend API is running smoothly.',
    service: 'RescueLink Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
  });
};

module.exports = {
  getHealthStatus,
};
