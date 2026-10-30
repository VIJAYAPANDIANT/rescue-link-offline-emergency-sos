/**
 * RescueLink Relay Repository
 *
 * Provides data-access operations for multi-device BLE relay history and auditing in SQLite.
 * Tracks received, forwarded, and dropped relay attempts.
 */

import { getDatabase } from './database.js';

export class RelayRepository {
  /**
   * Record a relay lifecycle event (RECEIVED, FORWARDED, DROPPED).
   *
   * @param {object} params
   * @param {string} params.alertId - Associated distress alert ID
   * @param {'RECEIVED'|'FORWARDED'|'DROPPED'} params.action - Relay action
   * @param {number} [params.hopCount=0] - Hop count at time of event
   * @param {string} [params.forwarderId] - Node ID that forwarded this hop
   * @param {string} [params.previousHopId] - Device ID of previous peer
   * @param {string} [params.statusReason] - Explanation / rejection reason
   * @param {object|string} [params.metadata] - Additional contextual metadata
   * @param {string} [params.timestamp] - Event ISO timestamp
   * @returns {Promise<object>} Inserted relay history record
   */
  static async recordRelayEvent({
    alertId,
    action,
    hopCount = 0,
    forwarderId = null,
    previousHopId = null,
    statusReason = null,
    metadata = null,
    timestamp = null,
  }) {
    if (!alertId || typeof alertId !== 'string') {
      throw new Error('Valid alertId is required to record a relay event.');
    }

    const validActions = ['RECEIVED', 'FORWARDED', 'DROPPED'];
    if (!action || !validActions.includes(action)) {
      throw new Error(`Invalid relay action "${action}". Expected one of: ${validActions.join(', ')}.`);
    }

    const db = await getDatabase();
    const finalTimestamp = timestamp || new Date().toISOString();
    const serializedMetadata =
      metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || null;

    const result = await db.runAsync(
      `INSERT INTO relay_history (
        alertId,
        action,
        hopCount,
        forwarderId,
        previousHopId,
        statusReason,
        timestamp,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        alertId,
        action,
        typeof hopCount === 'number' ? hopCount : 0,
        forwarderId || null,
        previousHopId || null,
        statusReason || null,
        finalTimestamp,
        serializedMetadata,
      ]
    );

    return {
      id: result?.lastInsertRowId,
      alertId,
      action,
      hopCount: typeof hopCount === 'number' ? hopCount : 0,
      forwarderId,
      previousHopId,
      statusReason,
      timestamp: finalTimestamp,
      metadata: serializedMetadata,
    };
  }

  /**
   * Check whether this device has already forwarded a given alert.
   * Prevents relay loops and duplicate transmissions.
   *
   * @param {string} alertId
   * @returns {Promise<boolean>}
   */
  static async hasAlreadyForwarded(alertId) {
    if (!alertId) return false;
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT id FROM relay_history WHERE alertId = ? AND action = 'FORWARDED' LIMIT 1;`,
      [alertId]
    );
    return !!row;
  }

  /**
   * Get the total count of distinct alerts successfully forwarded by this device.
   *
   * @returns {Promise<number>}
   */
  static async getForwardedCount() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT COUNT(DISTINCT alertId) as count FROM relay_history WHERE action = 'FORWARDED';`
    );
    return row?.count || 0;
  }

  /**
   * Get aggregate relay statistics (totalReceived, totalForwarded, totalDropped).
   *
   * @returns {Promise<{ totalReceived: number, totalForwarded: number, totalDropped: number }>}
   */
  static async getRelayStats() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT action, COUNT(*) as count FROM relay_history GROUP BY action;`
    );

    const stats = {
      totalReceived: 0,
      totalForwarded: 0,
      totalDropped: 0,
    };

    for (const r of rows) {
      if (r.action === 'RECEIVED') stats.totalReceived = r.count;
      else if (r.action === 'FORWARDED') stats.totalForwarded = r.count;
      else if (r.action === 'DROPPED') stats.totalDropped = r.count;
    }

    return stats;
  }

  /**
   * Get the number of forward actions executed since a given timestamp.
   * Used for sliding-window rate limiting.
   *
   * @param {string} sinceIso
   * @returns {Promise<number>}
   */
  static async getRecentForwardCount(sinceIso) {
    if (!sinceIso) return 0;
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM relay_history WHERE action = 'FORWARDED' AND timestamp >= ?;`,
      [sinceIso]
    );
    return row?.count || 0;
  }

  /**
   * Retrieve relay history events for a given alert or all alerts.
   *
   * @param {object} [options]
   * @param {string} [options.alertId]
   * @param {string} [options.action]
   * @param {number} [options.limit=50]
   * @param {number} [options.offset=0]
   * @returns {Promise<Array>}
   */
  static async getRelayHistory({ alertId, action, limit = 50, offset = 0 } = {}) {
    const db = await getDatabase();
    const whereClauses = [];
    const params = [];

    if (alertId) {
      whereClauses.push('alertId = ?');
      params.push(alertId);
    }

    if (action) {
      whereClauses.push('action = ?');
      params.push(action);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM relay_history
      ${whereStr}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?;
    `;
    params.push(limit, offset);

    const rows = await db.getAllAsync(sql, params);
    return rows.map((r) => {
      let parsedMeta = null;
      if (r.metadata) {
        try {
          parsedMeta = JSON.parse(r.metadata);
        } catch (e) {
          parsedMeta = r.metadata;
        }
      }
      return {
        ...r,
        metadata: parsedMeta,
      };
    });
  }
}

export default RelayRepository;
