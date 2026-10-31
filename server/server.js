/**
 * RescueLink Emergency Backend Server
 * Production-ready entry point for Express application.
 */
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');
const { globalRateLimiter } = require('./middleware/rateLimit.middleware');

// Validate runtime environment configuration on boot
config.validateEnvironment();

const app = express();

// Security: Disable Express fingerprint header
app.disable('x-powered-by');

// Security: Enforce HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Middleware: Enable Cross-Origin Resource Sharing (CORS) with origin validation
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins === '*' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked request from origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
}));

// Security: Request body parsing with strict size bounds (1MB max payload)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security: Global IP-based rate limiting (exempts health and real-time streams)
app.use(globalRateLimiter);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    project: 'RescueLink — Offline Bluetooth Emergency SOS System',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      liveness: '/api/health',
      readiness: '/api/ready',
    },
  });
});

// Mount API routes under /api
app.use('/api', apiRoutes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

// Start server if executed directly
let server = null;
if (require.main === module) {
  const PORT = config.port;
  server = app.listen(PORT, () => {
    console.log('====================================================');
    console.log(` RescueLink Emergency Backend Server Running`);
    console.log(` Port:        http://localhost:${PORT}`);
    console.log(` Health:      http://localhost:${PORT}/api/health`);
    console.log(` Readiness:   http://localhost:${PORT}/api/ready`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log('====================================================');
  });
}

// Graceful shutdown handler for zero-downtime rolling deploys
const handleShutdown = (signal) => {
  console.log(`\n[Server] ${signal} signal received: commencing graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP connections drained. Process exiting cleanly.');
      process.exit(0);
    });

    // Force exit if connections fail to close within 10 seconds
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = app;
