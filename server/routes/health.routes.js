const express = require('express');
const { getHealthStatus, getReadinessStatus } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Liveness check probe & uptime status
 * @access  Public
 */
router.get('/health', getHealthStatus);

/**
 * @route   GET /api/ready
 * @desc    Readiness check probe & storage health
 * @access  Public
 */
router.get('/ready', getReadinessStatus);

module.exports = router;
