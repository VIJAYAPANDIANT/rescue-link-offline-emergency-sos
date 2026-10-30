/**
 * RescueLink Emergency Notification Routes
 * Mounted at /api/notifications
 */

const express = require('express');
const {
  getNotifications,
  testNotification,
} = require('../controllers/notification.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/notifications
 * @desc    Get notification delivery logs for authenticated user
 * @access  Protected
 */
router.get('/', getNotifications);

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification to verify delivery channels
 * @access  Protected
 */
router.post('/test', testNotification);

module.exports = router;
