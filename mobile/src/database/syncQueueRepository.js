/**
 * RescueLink Sync Queue (Offline Outbox) Repository
 *
 * Implements an offline outbox pattern to track pending server operations.
 * Allows alerts and status changes created offline to be reliably queued
 * for future cloud synchronization (Step 6).
 */

import { getDatabase } from './database.js';

export class SyncQueueRepository {
  /**
   * Enqueue a pending server operation into the offline outbox.
   *
   * @param {object} params
   * @param {string} params.alertId - Target alert identifier
   * @param {'CREATE' | 'UPDATE_STATUS' | 'RESOLVE'} params.operation - Server operation type
   * @param {object|string} params.payload - Payload to be dispatched when online
   */
  static async enqueue({ alertId, operation, payload }) {
    if (!alertId || !operation) {
      throw new Error('alertId and operation are required to enqueue sync items.');
    }

    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload || '{}';

    await db.runAsync(
      `INSERT INTO sync_queue (
        alertId,
        operation,
        payload,
        status,
        retryCount,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, 'pending', 0, ?, ?);`,
      [alertId, operation, payloadStr, nowIso, nowIso]
    );

    return {
      alertId,
      operation,
      payload: payloadStr,
      status: 'pending',
      retryCount: 0,
      createdAt: nowIso,
    };
  }

  /**
   * Retrieve all pending outbox queue records ordered chronologically.
   */
  static async getPendingItems() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY createdAt ASC;"
    );

    return rows.map((item) => ({
      ...item,
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload,
    }));
  }

  /**
   * Mark a sync queue item as failed with an error message.
   */
  static async markFailed(id, errorMessage) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed',
           retryCount = retryCount + 1,
           errorMessage = ?,
           updatedAt = ?
       WHERE id = ?;`,
      [errorMessage || 'Unknown sync error', nowIso, id]
    );
  }

  /**
   * Remove a completed sync queue record once synchronized by the sync engine.
   */
  static async remove(id) {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  /**
   * Retrieve total number of pending items in the offline sync outbox.
   */
  static async getPendingCount() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';"
    );
    return row?.count || 0;
  }
}

export default SyncQueueRepository;
