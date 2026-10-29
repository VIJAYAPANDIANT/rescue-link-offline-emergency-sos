/**
 * Emergency Alert Routes
 * Mounted at /api/alerts
 */

const express = require('express');
const {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlertStatus,
  syncAlerts,
} = require('../controllers/alert.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * All alert routes require a valid JSON Web Token
 */
router.use(authenticateToken);

/**
 * @route   POST /api/alerts/sync
 * @desc    Synchronize a batch of offline emergency alerts
 * @access  Protected
 */
router.post('/sync', syncAlerts);

/**
 * @route   POST /api/alerts
 * @desc    Create a new emergency alert
 * @access  Protected
 */
router.post('/', createAlert);

/**
 * @route   GET /api/alerts
 * @desc    Retrieve all alerts owned by the authenticated user
 * @access  Protected
 */
router.get('/', getAlerts);

/**
 * @route   GET /api/alerts/:id
 * @desc    Retrieve one alert by ID owned by the authenticated user
 * @access  Protected
 */
router.get('/:id', getAlertById);

/**
 * @route   PATCH /api/alerts/:id/status
 * @desc    Update alert status (e.g. mark Resolved)
 * @access  Protected
 */
router.patch('/:id/status', updateAlertStatus);

module.exports = router;
