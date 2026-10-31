/**
 * Health & Readiness Controller
 * Provides liveness and readiness verification for production deployments.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const REQUIRED_FILES = ['users.json', 'alerts.json', 'contacts.json', 'notifications.json', 'audit_logs.json'];

/**
 * Liveness probe: Verifies that the Express process is active and accepting connections.
 * @route GET /api/health
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

/**
 * Readiness probe: Verifies that storage systems are accessible and writable.
 * @route GET /api/ready
 */
const getReadinessStatus = async (req, res) => {
  const checks = {
    storageDirectory: false,
    dataStores: {},
    memory: 'ok',
  };

  let isReady = true;

  try {
    // 1. Verify storage directory existence
    if (fs.existsSync(DATA_DIR)) {
      checks.storageDirectory = true;
    } else {
      isReady = false;
    }

    // 2. Verify all data stores
    for (const fileName of REQUIRED_FILES) {
      const filePath = path.join(DATA_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          await fs.promises.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
          checks.dataStores[fileName] = 'accessible';
        } catch (e) {
          checks.dataStores[fileName] = 'permission_error';
          isReady = false;
        }
      } else {
        checks.dataStores[fileName] = 'initialized_on_first_write';
      }
    }

    // 3. Memory metrics check
    const mem = process.memoryUsage();
    checks.memoryStats = {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
    };
  } catch (err) {
    isReady = false;
    checks.error = err.message;
  }

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    success: isReady,
    status: isReady ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealthStatus,
  getReadinessStatus,
};
