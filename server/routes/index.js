const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

// Health check endpoint mounted at /api/health
router.use('/', healthRoutes);

// Future endpoints will be mounted here in subsequent steps:
// router.use('/auth', authRoutes);         // Step 2: User registration, login, JWT
// router.use('/alerts', alertRoutes);     // Step 4: Emergency alert sync & cloud storage

module.exports = router;
