/**
 * Emergency Alert Controller
 *
 * Implements REST endpoints for emergency distress alerts.
 */

const alertService = require('../services/alert.service');

/**
 * Create a new emergency alert
 * @route POST /api/alerts
 * @access Protected (JWT required)
 */
const createAlert = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { emergencyType, details, contactDetails, location } = req.body;

    const alert = await alertService.createAlert({
      senderId,
      emergencyType,
      details,
      contactDetails,
      location,
    });

    return res.status(201).json({
      success: true,
      message: 'Emergency alert created successfully',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all emergency alerts created by the authenticated user
 * @route GET /api/alerts
 * @access Protected (JWT required)
 */
const getAlerts = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { status } = req.query;

    const alerts = await alertService.getAlerts(senderId, status);

    return res.status(200).json({
      success: true,
      message: 'Alerts retrieved successfully',
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single emergency alert by ID belonging to the authenticated user
 * @route GET /api/alerts/:id
 * @access Protected (JWT required)
 */
const getAlertById = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const alertId = req.params.id;

    const alert = await alertService.getAlertById(alertId, senderId);

    return res.status(200).json({
      success: true,
      message: 'Alert retrieved successfully',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update the status of an emergency alert owned by the authenticated user
 * @route PATCH /api/alerts/:id/status
 * @access Protected (JWT required)
 */
const updateAlertStatus = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const alertId = req.params.id;
    const { status } = req.body;

    const updatedAlert = await alertService.updateAlertStatus(alertId, senderId, status);

    return res.status(200).json({
      success: true,
      message: 'Alert status updated successfully',
      data: updatedAlert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronize a batch of offline emergency alerts
 * @route POST /api/alerts/sync
 * @access Protected (JWT required)
 */
const syncAlerts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Accept either { alerts: [...] } or direct array [...] or { items: [...] }
    const alertItems = Array.isArray(req.body)
      ? req.body
      : req.body?.alerts || req.body?.items || [];

    const result = await alertService.syncAlerts(userId, alertItems);

    return res.status(200).json({
      success: true,
      message: `Sync completed: ${result.summary.synced} synced, ${result.summary.alreadySynced} already synced, ${result.summary.failed} failed.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlertStatus,
  syncAlerts,
};
