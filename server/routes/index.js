const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const alertRoutes = require('./alert.routes');

const router = express.Router();

// Health check endpoint mounted at /api/health
router.use('/', healthRoutes);

// Authentication endpoints mounted at /api/auth
router.use('/auth', authRoutes);

// Emergency Alert endpoints mounted at /api/alerts
router.use('/alerts', alertRoutes);

module.exports = router;
