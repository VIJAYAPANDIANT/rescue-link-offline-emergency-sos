const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');

const router = express.Router();

// Health check endpoint mounted at /api/health
router.use('/', healthRoutes);

// Authentication endpoints mounted at /api/auth
router.use('/auth', authRoutes);

// Future endpoints will be mounted here in subsequent steps:
// router.use('/alerts', alertRoutes); // Step 4: Emergency alert sync & cloud storage

module.exports = router;
