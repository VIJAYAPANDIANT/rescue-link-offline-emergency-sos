/**
 * Alert Business Service
 *
 * Implements validation, ownership verification, and workflow management for emergency alerts.
 */

const alertStore = require('./alertStore');
const userStore = require('./userStore');

const ALLOWED_EMERGENCY_TYPES = [
  'Medical Emergency',
  'Accident',
  'Personal Safety',
  'Fire',
  'Other',
];

const ALLOWED_STATUSES = ['Pending', 'Acknowledged', 'Resolved'];

class AlertService {
  /**
   * Validate and create a new emergency alert.
   *
   * @param {object} params
   * @param {string} params.senderId
   * @param {string} params.emergencyType
   * @param {string} [params.details]
   * @param {string} [params.contactDetails]
   * @param {object|null} [params.location]
   */
  async createAlert({ senderId, emergencyType, details, contactDetails, location }) {
    if (!senderId) {
      const err = new Error('Authentication required: missing sender identifier.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    // Look up safe sender profile
    const user = await userStore.findById(senderId);
    if (!user) {
      const err = new Error('Sender user profile not found.');
      err.statusCode = 401;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Validate emergencyType
    if (!emergencyType || typeof emergencyType !== 'string' || !ALLOWED_EMERGENCY_TYPES.includes(emergencyType)) {
      const err = new Error(
        `Invalid emergency type "${emergencyType}". Allowed types: ${ALLOWED_EMERGENCY_TYPES.join(', ')}.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_EMERGENCY_TYPE';
      throw err;
    }

    // Validate details
    let sanitizedDetails = '';
    if (details !== undefined && details !== null) {
      if (typeof details !== 'string') {
        const err = new Error('Details must be a text string.');
        err.statusCode = 400;
        err.code = 'INVALID_DETAILS';
        throw err;
      }
      sanitizedDetails = details.trim();
      if (sanitizedDetails.length > 1000) {
        const err = new Error('Details text must not exceed 1000 characters.');
        err.statusCode = 400;
        err.code = 'DETAILS_TOO_LONG';
        throw err;
      }
    }

    // Validate contactDetails
    let sanitizedContactDetails = '';
    if (contactDetails !== undefined && contactDetails !== null) {
      if (typeof contactDetails !== 'string') {
        const err = new Error('Contact details must be a text string.');
        err.statusCode = 400;
        err.code = 'INVALID_CONTACT_DETAILS';
        throw err;
      }
      sanitizedContactDetails = contactDetails.trim();
      if (sanitizedContactDetails.length > 200) {
        const err = new Error('Contact details must not exceed 200 characters.');
        err.statusCode = 400;
        err.code = 'CONTACT_TOO_LONG';
        throw err;
      }
    }

    // Validate location
    let sanitizedLocation = null;
    if (location !== undefined && location !== null && Object.keys(location).length > 0) {
      if (typeof location !== 'object') {
        const err = new Error('Location must be an object containing latitude and longitude.');
        err.statusCode = 400;
        err.code = 'INVALID_LOCATION_FORMAT';
        throw err;
      }

      const { latitude, longitude } = location;

      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        const err = new Error('Both latitude and longitude are required when a location is provided.');
        err.statusCode = 400;
        err.code = 'INCOMPLETE_COORDINATES';
        throw err;
      }

      if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        const err = new Error('Latitude must be a valid number between -90 and 90.');
        err.statusCode = 400;
        err.code = 'INVALID_LATITUDE';
        throw err;
      }

      if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        const err = new Error('Longitude must be a valid number between -180 and 180.');
        err.statusCode = 400;
        err.code = 'INVALID_LONGITUDE';
        throw err;
      }

      sanitizedLocation = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    }

    // Persist via store
    const createdAlert = await alertStore.createAlert({
      senderId: user.id,
      senderName: user.name,
      emergencyType,
      details: sanitizedDetails,
      contactDetails: sanitizedContactDetails,
      location: sanitizedLocation,
    });

    return createdAlert;
  }

  /**
   * Get all alerts belonging to the authenticated sender.
   *
   * @param {string} senderId
   * @param {string} [statusFilter]
   */
  async getAlerts(senderId, statusFilter) {
    if (statusFilter && !ALLOWED_STATUSES.includes(statusFilter)) {
      const err = new Error(
        `Invalid status filter "${statusFilter}". Allowed values: ${ALLOWED_STATUSES.join(', ')}.`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FILTER';
      throw err;
    }

    return alertStore.findBySenderId(senderId, statusFilter);
  }

  /**
   * Retrieve a single alert, strictly checking ownership.
   * Returns 404 if the alert does not exist OR belongs to another user.
   *
   * @param {string} alertId
   * @param {string} senderId
   */
  async getAlertById(alertId, senderId) {
    const alert = await alertStore.findById(alertId);

    // Conceal existence of unowned alerts to prevent user enumeration
    if (!alert || alert.senderId !== senderId) {
      const err = new Error('The requested emergency alert was not found.');
      err.statusCode = 404;
      err.code = 'ALERT_NOT_FOUND';
      throw err;
    }

    return alert;
  }

  /**
   * Update alert status with ownership check and transition rules.
   *
   * @param {string} alertId
   * @param {string} senderId
   * @param {string} newStatus
   */
  async updateAlertStatus(alertId, senderId, newStatus) {
    const alert = await alertStore.findById(alertId);

    if (!alert || alert.senderId !== senderId) {
      const err = new Error('The requested emergency alert was not found.');
      err.statusCode = 404;
      err.code = 'ALERT_NOT_FOUND';
      throw err;
    }

    if (!newStatus || typeof newStatus !== 'string') {
      const err = new Error('Status field is required.');
      err.statusCode = 400;
      err.code = 'MISSING_STATUS';
      throw err;
    }

    // Direct transition to Acknowledged is reserved for receivers
    if (newStatus === 'Acknowledged') {
      const err = new Error(
        'Direct status transition to "Acknowledged" is not supported. Acknowledgment is reserved for receiver confirmation.'
      );
      err.statusCode = 400;
      err.code = 'TRANSITION_NOT_PERMITTED';
      throw err;
    }

    if (newStatus !== 'Resolved') {
      const err = new Error(
        `Unsupported status transition to "${newStatus}". In this step, senders may only mark their alert "Resolved".`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_TRANSITION';
      throw err;
    }

    if (alert.status === 'Resolved') {
      const err = new Error('Alert is already marked as Resolved.');
      err.statusCode = 400;
      err.code = 'ALREADY_RESOLVED';
      throw err;
    }

    const updatedAlert = await alertStore.updateStatus(alertId, 'Resolved');
    return updatedAlert;
  }

  /**
   * Batch synchronize alerts from an authenticated client with idempotent deduplication
   * and strict origin/relay attribution.
   *
   * @param {string} userId - Authenticated user ID
   * @param {Array<object>} alertItems - Batch of alerts to synchronize
   */
  async syncAlerts(userId, alertItems) {
    if (!userId) {
      const err = new Error('Authentication required for synchronization.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const user = await userStore.findById(userId);
    if (!user) {
      const err = new Error('Authenticated user profile not found.');
      err.statusCode = 401;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (!Array.isArray(alertItems)) {
      const err = new Error('alerts payload must be an array of alert objects.');
      err.statusCode = 400;
      err.code = 'INVALID_SYNC_PAYLOAD';
      throw err;
    }

    const results = [];
    let syncedCount = 0;
    let alreadySyncedCount = 0;
    let failedCount = 0;

    for (const item of alertItems) {
      try {
        const alertId = item.alertId || item.id;
        if (!alertId || typeof alertId !== 'string' || !alertId.trim()) {
          results.push({
            alertId: alertId || 'unknown',
            status: 'failed',
            error: 'Missing required string alertId.',
          });
          failedCount++;
          continue;
        }

        const cleanAlertId = alertId.trim();

        // 1. Validate emergencyType
        if (
          !item.emergencyType ||
          typeof item.emergencyType !== 'string' ||
          !ALLOWED_EMERGENCY_TYPES.includes(item.emergencyType)
        ) {
          results.push({
            alertId: cleanAlertId,
            status: 'failed',
            error: `Invalid emergency type "${item.emergencyType}". Allowed: ${ALLOWED_EMERGENCY_TYPES.join(', ')}.`,
          });
          failedCount++;
          continue;
        }

        // 2. Validate details
        let sanitizedDetails = '';
        if (item.details !== undefined && item.details !== null) {
          if (typeof item.details !== 'string') {
            results.push({
              alertId: cleanAlertId,
              status: 'failed',
              error: 'Details must be a text string.',
            });
            failedCount++;
            continue;
          }
          sanitizedDetails = item.details.trim();
          if (sanitizedDetails.length > 1000) {
            results.push({
              alertId: cleanAlertId,
              status: 'failed',
              error: 'Details must not exceed 1000 characters.',
            });
            failedCount++;
            continue;
          }
        }

        // 3. Validate contactDetails
        let sanitizedContact = '';
        if (item.contactDetails !== undefined && item.contactDetails !== null) {
          if (typeof item.contactDetails !== 'string') {
            results.push({
              alertId: cleanAlertId,
              status: 'failed',
              error: 'Contact details must be a text string.',
            });
            failedCount++;
            continue;
          }
          sanitizedContact = item.contactDetails.trim();
          if (sanitizedContact.length > 200) {
            results.push({
              alertId: cleanAlertId,
              status: 'failed',
              error: 'Contact details must not exceed 200 characters.',
            });
            failedCount++;
            continue;
          }
        }

        // 4. Validate location
        let sanitizedLocation = null;
        if (item.location && typeof item.location === 'object') {
          const { latitude, longitude } = item.location;
          if (typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
              results.push({
                alertId: cleanAlertId,
                status: 'failed',
                error: 'Coordinates out of bounds (-90 to 90, -180 to 180).',
              });
              failedCount++;
              continue;
            }
            sanitizedLocation = {
              latitude: Number(latitude),
              longitude: Number(longitude),
            };
          }
        }

        // 5. Origin and Relay Authorization:
        // If alert originated via BLE, preserve peer author metadata while recording authenticated relay node
        const isBleSource = item.source === 'bluetooth' || item.source === 'bluetooth_relay';
        const senderId = isBleSource ? null : user.id;
        const senderName = isBleSource
          ? (item.originalSenderName || item.senderName || 'Peer via BLE')
          : user.name;
        const relayedBy = isBleSource ? user.id : null;
        const relayedByName = isBleSource ? user.name : null;
        const finalSource = isBleSource ? 'bluetooth_relay' : 'local';

        // 6. Perform idempotent sync write
        const syncResult = await alertStore.syncAlert({
          id: cleanAlertId,
          senderId,
          senderName,
          emergencyType: item.emergencyType,
          details: sanitizedDetails,
          contactDetails: sanitizedContact,
          location: sanitizedLocation,
          source: finalSource,
          relayedBy,
          relayedByName,
          status: item.deliveryStatus === 'Resolved' || item.status === 'Resolved' ? 'Resolved' : 'Pending',
          createdAt: item.createdAt || new Date().toISOString(),
        });

        if (syncResult.isNew) {
          results.push({
            alertId: cleanAlertId,
            status: 'synced',
            alert: syncResult.alert,
          });
          syncedCount++;
        } else {
          results.push({
            alertId: cleanAlertId,
            status: 'already_synced',
            alert: syncResult.alert,
          });
          alreadySyncedCount++;
        }
      } catch (itemErr) {
        results.push({
          alertId: item.alertId || item.id || 'unknown',
          status: 'failed',
          error: itemErr.message || 'Processing error',
        });
        failedCount++;
      }
    }

    return {
      success: true,
      results,
      summary: {
        synced: syncedCount,
        alreadySynced: alreadySyncedCount,
        failed: failedCount,
        total: alertItems.length,
      },
    };
  }
}

const alertService = new AlertService();
module.exports = alertService;
