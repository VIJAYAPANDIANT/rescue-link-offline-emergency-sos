const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    API Health Check & uptime status
 * @access  Public
 */
router.get('/health', getHealthStatus);

module.exports = router;
