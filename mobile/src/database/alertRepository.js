/**
 * RescueLink Alert Repository
 *
 * Provides data-access operations for emergency SOS distress records in SQLite.
 * Handles persistence, queries, duplicate prevention, and state updates.
 */

import { getDatabase } from './database.js';

export class AlertRepository {
  /**
   * Save a new alert or intelligently update an existing alert without regressions.
   *
   * @param {object} alertData
   * @returns {Promise<{ alert: object, isNew: boolean }>}
   */
  static async saveOrUpdateAlert(alertData) {
    if (!alertData) {
      throw new Error('Alert data is required.');
    }

    const alertId = alertData.alertId || alertData.id;
    if (!alertId) {
      throw new Error('Valid alertId is required to save an alert.');
    }

    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    // Check if alert already exists in SQLite
    const existing = await db.getFirstAsync(
      'SELECT * FROM alerts WHERE alertId = ?;',
      [alertId]
    );

    if (existing) {
      // Intelligent update: preserve local un-synced changes and confirmed acknowledgments
      const finalAckStatus =
        existing.ackStatus === 'acknowledged' || alertData.ackStatus === 'acknowledged'
          ? 'acknowledged'
          : alertData.ackStatus || existing.ackStatus;

      const finalDeliveryStatus = alertData.deliveryStatus || existing.deliveryStatus;

      // If local alert has pending sync, don't overwrite with 'not_synced'
      let finalSyncStatus = existing.syncStatus;
      if (alertData.syncStatus) {
        if (existing.syncStatus === 'pending_sync' && alertData.syncStatus === 'not_synced') {
          finalSyncStatus = 'pending_sync';
        } else {
          finalSyncStatus = alertData.syncStatus;
        }
      }

      await db.runAsync(
        `UPDATE alerts SET
          senderId = COALESCE(?, senderId),
          senderName = COALESCE(?, senderName),
          emergencyType = COALESCE(?, emergencyType),
          details = COALESCE(?, details),
          contactDetails = COALESCE(?, contactDetails),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          deliveryStatus = ?,
          ackStatus = ?,
          syncStatus = ?,
          updatedAt = ?
        WHERE alertId = ?;`,
        [
          alertData.senderId || null,
          alertData.senderName || null,
          alertData.emergencyType || null,
          alertData.details || null,
          alertData.contactDetails || null,
          typeof alertData.latitude === 'number' ? alertData.latitude : null,
          typeof alertData.longitude === 'number' ? alertData.longitude : null,
          finalDeliveryStatus,
          finalAckStatus,
          finalSyncStatus,
          nowIso,
          alertId,
        ]
      );

      const updated = await db.getFirstAsync(
        'SELECT * FROM alerts WHERE alertId = ?;',
        [alertId]
      );

      return { alert: updated, isNew: false };
    }

    // Insert new alert
    const source = alertData.source || 'local';
    const deliveryStatus = alertData.deliveryStatus || (source === 'bluetooth' ? 'received' : 'pending');
    const ackStatus = alertData.ackStatus || 'unacknowledged';
    const syncStatus = alertData.syncStatus || (source === 'server' ? 'synced' : 'pending_sync');
    const createdAt = alertData.createdAt || nowIso;
    const updatedAt = alertData.updatedAt || nowIso;

    await db.runAsync(
      `INSERT INTO alerts (
        alertId,
        senderId,
        senderName,
        emergencyType,
        details,
        contactDetails,
        latitude,
        longitude,
        createdAt,
        source,
        deliveryStatus,
        ackStatus,
        syncStatus,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        alertId,
        alertData.senderId || null,
        alertData.senderName || 'Anonymous',
        alertData.emergencyType || 'Other',
        alertData.details || '',
        alertData.contactDetails || '',
        typeof alertData.latitude === 'number' ? alertData.latitude : null,
        typeof alertData.longitude === 'number' ? alertData.longitude : null,
        createdAt,
        source,
        deliveryStatus,
        ackStatus,
        syncStatus,
        updatedAt,
      ]
    );

    const inserted = await db.getFirstAsync(
      'SELECT * FROM alerts WHERE alertId = ?;',
      [alertId]
    );

    return { alert: inserted, isNew: true };
  }

  /**
   * Retrieve a single alert by unique alertId.
   */
  static async getAlertById(alertId) {
    if (!alertId) return null;
    const db = await getDatabase();
    return db.getFirstAsync('SELECT * FROM alerts WHERE alertId = ?;', [alertId]);
  }

  /**
   * Retrieve all alerts with optional filtering and pagination.
   */
  static async getAlerts({
    source,
    deliveryStatus,
    ackStatus,
    syncStatus,
    limit = 100,
    offset = 0,
  } = {}) {
    const db = await getDatabase();
    const whereClauses = [];
    const params = [];

    if (source && source !== 'ALL') {
      whereClauses.push('source = ?');
      params.push(source.toLowerCase());
    }

    if (deliveryStatus && deliveryStatus !== 'ALL') {
      whereClauses.push('deliveryStatus = ?');
      params.push(deliveryStatus);
    }

    if (ackStatus && ackStatus !== 'ALL') {
      whereClauses.push('ackStatus = ?');
      params.push(ackStatus);
    }

    if (syncStatus && syncStatus !== 'ALL') {
      whereClauses.push('syncStatus = ?');
      params.push(syncStatus);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
      SELECT * FROM alerts
      ${whereSql}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?;
    `;
    params.push(limit, offset);

    return db.getAllAsync(query, params);
  }

  /**
   * Update the delivery status of an alert (e.g. 'Resolved', 'broadcasted').
   */
  static async updateAlertStatus(alertId, newStatus) {
    if (!alertId || !newStatus) {
      throw new Error('alertId and newStatus are required.');
    }
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      'UPDATE alerts SET deliveryStatus = ?, updatedAt = ? WHERE alertId = ?;',
      [newStatus, nowIso, alertId]
    );

    return this.getAlertById(alertId);
  }

  /**
   * Update the acknowledgment status of an alert.
   */
  static async updateAlertAck(alertId, ackStatus = 'acknowledged') {
    if (!alertId) return null;
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      'UPDATE alerts SET ackStatus = ?, updatedAt = ? WHERE alertId = ?;',
      [ackStatus, nowIso, alertId]
    );

    return this.getAlertById(alertId);
  }

  /**
   * Update the sync status of an alert.
   */
  static async updateAlertSyncStatus(alertId, syncStatus) {
    if (!alertId || !syncStatus) return null;
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      'UPDATE alerts SET syncStatus = ?, updatedAt = ? WHERE alertId = ?;',
      [syncStatus, nowIso, alertId]
    );

    return this.getAlertById(alertId);
  }

  /**
   * Delete an alert by alertId.
   */
  static async deleteAlert(alertId) {
    if (!alertId) return false;
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM alerts WHERE alertId = ?;', [alertId]);
    return result.changes > 0;
  }

  /**
   * Return high-level aggregate counts of alert states for dashboard cards.
   */
  static async getAlertCounts() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN source = 'local' THEN 1 ELSE 0 END) as localCount,
        SUM(CASE WHEN source = 'bluetooth' THEN 1 ELSE 0 END) as bleCount,
        SUM(CASE WHEN source = 'server' THEN 1 ELSE 0 END) as serverCount,
        SUM(CASE WHEN ackStatus = 'acknowledged' THEN 1 ELSE 0 END) as ackCount,
        SUM(CASE WHEN syncStatus = 'pending_sync' THEN 1 ELSE 0 END) as pendingSyncCount,
        SUM(CASE WHEN deliveryStatus = 'Resolved' THEN 1 ELSE 0 END) as resolvedCount
      FROM alerts;
    `);

    return rows[0] || {
      total: 0,
      localCount: 0,
      bleCount: 0,
      serverCount: 0,
      ackCount: 0,
      pendingSyncCount: 0,
      resolvedCount: 0,
    };
  }
}

export default AlertRepository;
