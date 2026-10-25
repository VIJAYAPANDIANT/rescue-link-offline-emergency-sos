/**
 * RescueLink Emergency Backend Server
 * Core entry point for Express application.
 */
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Middleware: Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*', // Permissive for local mobile app development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware: Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    project: 'RescueLink — Offline Bluetooth Emergency SOS System',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health for system status check',
  });
});

// Mount API routes under /api
app.use('/api', apiRoutes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(` RescueLink Emergency Backend Server Running`);
  console.log(` Port:        http://localhost:${PORT}`);
  console.log(` Health:      http://localhost:${PORT}/api/health`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log('====================================================');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;
