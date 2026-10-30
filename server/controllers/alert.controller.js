/**
 * Emergency Alert Controller
 *
 * Implements REST endpoints for emergency distress alerts.
 */

const alertService = require('../services/alert.service');
const alertStore = require('../services/alertStore');

/**
 * Create a new emergency alert
 * @route POST /api/alerts
 * @access Protected (JWT required)
 */
const createAlert = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { emergencyType, details, contactDetails, location, locationConsent } = req.body;

    const alert = await alertService.createAlert({
      senderId,
      emergencyType,
      details,
      contactDetails,
      location,
      locationConsent,
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

/**
 * Retrieve all emergency incidents with valid GPS coordinates for the Live Map
 * @route GET /api/alerts/map
 * @access Protected (JWT required)
 */
const getMappedAlerts = async (req, res, next) => {
  try {
    const { status, emergencyType, since } = req.query;
    const result = await alertService.getMappedAlerts({ status, emergencyType, since });

    return res.status(200).json({
      success: true,
      message: 'Mapped emergency incidents retrieved successfully',
      data: result.alerts,
      summary: result.summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Server-Sent Events (SSE) live feed of emergency alert events
 * @route GET /api/alerts/stream
 * @access Protected (JWT required in Header or query param ?token=...)
 */
const streamAlerts = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connected confirmation event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      message: 'RescueLink Live Incident Stream Active',
      serverTime: new Date().toISOString(),
    })}\n\n`
  );

  const onAlertEvent = (event) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.alert)}\n\n`);
    } catch (e) {
      // Socket stream closed
    }
  };

  alertStore.on('alert_event', onAlertEvent);

  // Keep-alive heartbeat every 25 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    alertStore.removeListener('alert_event', onAlertEvent);
  });
};

module.exports = {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlertStatus,
  syncAlerts,
  getMappedAlerts,
  streamAlerts,
};
