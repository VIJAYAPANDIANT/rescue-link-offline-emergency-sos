/**
 * RescueLink Emergency Notification Controller
 *
 * Provides REST handlers for viewing emergency notification delivery
 * history and testing notification providers.
 */

const notificationStore = require('../services/notificationStore');
const notificationService = require('../services/notification/notificationService');

/**
 * Retrieve notification history for the authenticated user's alerts.
 * @route GET /api/notifications
 * @access Protected (JWT required)
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { alertId, channel, limit, offset } = req.query;

    const notifications = await notificationStore.findByUserId(userId, {
      alertId,
      channel,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger a test notification (Email or SMS) to verify provider setup.
 * @route POST /api/notifications/test
 * @access Protected (JWT required)
 */
const testNotification = async (req, res, next) => {
  try {
    const user = req.user;
    const { channel, recipient } = req.body;

    const result = await notificationService.testNotification(user, {
      channel,
      recipient,
    });

    return res.status(200).json({
      success: true,
      message: `Test notification sent via ${channel}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  testNotification,
};
